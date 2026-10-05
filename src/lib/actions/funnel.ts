'use server'

import { prisma } from '@/lib/db'
import { STEP_ORDER, WEEKDAYS, getStep, optionLabel, type Area, type StepId } from '@/lib/quiz/definition'

export type FunnelEventType =
  | 'quiz_started'
  | 'step_viewed'
  | 'step_answered'
  | 'result_viewed'
  | 'plan_created'

export type FunnelEventInput = {
  sessionId: string
  type: FunnelEventType
  step?: StepId
  value?: string
}

export type FunnelStage = {
  id: StepId | 'result' | 'plan'
  label: string
  sessions: number
  percentOfStart: number
  dropFromPrevious: number | null
}

const SESSION_ID = /^[A-Za-z0-9-]{8,40}$/
const MAX_VALUE_LENGTH = 100
const RECENT_LIMIT = 10

const EVENT_TYPES: readonly string[] = [
  'quiz_started',
  'step_viewed',
  'step_answered',
  'result_viewed',
  'plan_created',
]

const STAGE_LABELS: Record<FunnelStage['id'], string> = {
  area: 'Área',
  foco: 'Foco',
  prazo: 'Prazo',
  dias: 'Dias',
  obstaculo: 'Obstáculo',
  result: 'Resultado',
  plan: 'Plano criado',
}

const STAGE_IDS: readonly FunnelStage['id'][] = [...STEP_ORDER, 'result', 'plan']

function isStepId(value: unknown): value is StepId {
  return typeof value === 'string' && (STEP_ORDER as readonly string[]).includes(value)
}

const AREAS: readonly Area[] = ['saude', 'estudos', 'financas', 'carreira']

function isValidAnswer(step: StepId, value: string): boolean {
  if (step === 'dias') {
    const days = value.split(',')
    return days.every((d) => (WEEKDAYS as readonly string[]).includes(d))
  }
  if (step === 'foco') {
    return AREAS.some((area) => getStep('foco', { area }).options.some((o) => o.id === value))
  }
  return getStep(step, {}).options.some((o) => o.id === value)
}

// Tracking must never break the quiz: invalid events are dropped silently.
export async function trackFunnelEvent(event: FunnelEventInput): Promise<void> {
  try {
    const { sessionId, type, step, value } = event ?? ({} as FunnelEventInput)
    if (typeof sessionId !== 'string' || !SESSION_ID.test(sessionId)) return
    if (typeof type !== 'string' || !EVENT_TYPES.includes(type)) return

    const needsStep = type === 'step_viewed' || type === 'step_answered'
    if (needsStep && !isStepId(step)) return
    if (step !== undefined && !isStepId(step)) return
    if (value !== undefined && typeof value !== 'string') return
    if (type === 'step_answered' && step && value !== undefined && !isValidAnswer(step, value)) return

    await prisma.funnelEvent.create({
      data: {
        sessionId,
        type,
        step: needsStep ? (step ?? null) : null,
        value: value === undefined ? null : value.slice(0, MAX_VALUE_LENGTH),
      },
    })
  } catch {
    // Dropped on purpose.
  }
}

function percent(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 100)
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

export async function getFunnelStats() {
  const events = await prisma.funnelEvent.findMany({ orderBy: { createdAt: 'asc' } })

  type Session = {
    startedAt: Date | null
    planAt: Date | null
    viewed: Set<StepId>
    result: boolean
  }
  const sessions = new Map<string, Session>()
  const answerCounts = new Map<StepId, Map<string, number>>()

  for (const e of events) {
    let s = sessions.get(e.sessionId)
    if (!s) {
      s = { startedAt: null, planAt: null, viewed: new Set(), result: false }
      sessions.set(e.sessionId, s)
    }
    if (e.type === 'quiz_started') s.startedAt ??= e.createdAt
    else if (e.type === 'plan_created') s.planAt ??= e.createdAt
    else if (e.type === 'result_viewed') s.result = true
    else if (e.type === 'step_viewed' && isStepId(e.step)) s.viewed.add(e.step)
    else if (e.type === 'step_answered' && isStepId(e.step) && e.value) {
      const values = e.step === 'dias' ? e.value.split(',') : [e.value]
      const counts = answerCounts.get(e.step) ?? new Map<string, number>()
      for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
      answerCounts.set(e.step, counts)
    }
  }

  // Only sessions that have quiz_started take part, so every stage is a
  // subset of `starts`. Each session counts for every stage up to the
  // furthest one it reached, which keeps the funnel monotonic even when a
  // stage view was never recorded.
  const started = [...sessions.entries()].filter(([, s]) => s.startedAt !== null)
  const starts = started.length

  const reached = (s: Session, id: FunnelStage['id']) =>
    id === 'plan' ? s.planAt !== null : id === 'result' ? s.result : s.viewed.has(id)
  const furthestIndex = (s: Session) => {
    for (let i = STAGE_IDS.length - 1; i >= 0; i--) if (reached(s, STAGE_IDS[i])) return i
    return -1
  }
  const furthest = started.map(([, s]) => furthestIndex(s))

  const stages: FunnelStage[] = []
  STAGE_IDS.forEach((id, i) => {
    const count = furthest.filter((f) => f >= i).length
    const previous = i === 0 ? null : stages[i - 1].sessions
    stages.push({
      id,
      label: STAGE_LABELS[id],
      sessions: count,
      percentOfStart: percent(count, stages[0]?.sessions ?? count),
      dropFromPrevious: previous === null ? null : Math.max(0, percent(previous - count, previous)),
    })
  })

  let biggestDrop: FunnelStage | null = null
  for (const stage of stages) {
    if ((stage.dropFromPrevious ?? 0) > (biggestDrop?.dropFromPrevious ?? 0)) biggestDrop = stage
  }

  const conversion = starts === 0 ? null : percent(stages[stages.length - 1].sessions, starts)

  const secondsToPlan = started
    .filter(([, s]) => s.planAt !== null)
    .map(([, s]) => Math.round((s.planAt!.getTime() - s.startedAt!.getTime()) / 1000))

  const answers = STEP_ORDER.map((step) => {
    const counts = answerCounts.get(step) ?? new Map<string, number>()
    const total = [...counts.values()].reduce((sum, n) => sum + n, 0)
    const known = step === 'dias' ? WEEKDAYS.map(String) : getStep(step, {}).options.map((o) => o.id)
    const order = (v: string) => (known.includes(v) ? known.indexOf(v) : known.length)
    const options = [...counts.entries()]
      .map(([value, count]) => ({
        value,
        label: optionLabel(step, value),
        count,
        share: percent(count, total),
      }))
      .sort((a, b) => b.count - a.count || order(a.value) - order(b.value))
    return { step, title: getStep(step, {}).title, options }
  })

  const recent = [...started]
    .sort(([, a], [, b]) => b.startedAt!.getTime() - a.startedAt!.getTime())
    .slice(0, RECENT_LIMIT)
    .map(([sessionId, s]) => {
      const furthestId = STAGE_IDS[furthestIndex(s)]
      return {
        sessionId,
        startedAt: s.startedAt!,
        furthest: furthestId ? STAGE_LABELS[furthestId] : 'Início',
        created: s.planAt !== null,
      }
    })

  return {
    starts,
    conversion,
    medianSecondsToPlan: median(secondsToPlan),
    stages,
    biggestDrop,
    answers,
    recent,
  }
}
