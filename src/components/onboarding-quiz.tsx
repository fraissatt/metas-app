'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDate, formatDayMonth, getWeekBounds } from '@/lib/dates'
import type { FunnelEventInput } from '@/lib/actions/funnel'
import {
  STEP_ORDER,
  WEEKDAYS,
  WEEKDAY_LABELS,
  getStep,
  type QuizAnswers,
  type StepId,
  type Weekday,
} from '@/lib/quiz/definition'
import { buildPlan, type Plan } from '@/lib/quiz/build-plan'
import { newSessionId } from '@/lib/quiz/session'

type Props = {
  onTrack: (event: FunnelEventInput) => Promise<void>
  onCreate: (input: { sessionId: string; answers: QuizAnswers }) => Promise<void>
}

type Status = 'answering' | 'result' | 'creating' | 'error'
type Answers = Partial<QuizAnswers>

const TOTAL = STEP_ORDER.length

function answerValue(stepId: StepId, answers: Answers): string | undefined {
  const value = answers[stepId]
  if (value === undefined) return undefined
  return Array.isArray(value) ? value.join(',') : String(value)
}

function isAnswered(stepId: StepId, answers: Answers): boolean {
  const value = answers[stepId]
  return Array.isArray(value) ? value.length > 0 : value !== undefined
}

function withAnswer(answers: Answers, stepId: StepId, optionId: string): Answers {
  const next: Answers = { ...answers, [stepId]: stepId === 'prazo' ? Number(optionId) : optionId }
  // The focus options depend on the area, so a changed area invalidates it.
  if (stepId === 'area' && answers.area !== optionId) delete next.foco
  return next
}

function toggleDay(answers: Answers, day: Weekday): Answers {
  const chosen = new Set(answers.dias ?? [])
  if (chosen.has(day)) chosen.delete(day)
  else chosen.add(day)
  return { ...answers, dias: WEEKDAYS.filter((d) => chosen.has(d)) }
}

const weekdayOf = (date: Date): Weekday => WEEKDAYS[(date.getDay() + 6) % 7]

const optionClass = (selected: boolean) =>
  [
    'flex min-h-12 w-full items-center gap-3 rounded-lg border px-4 py-2 text-left text-base outline-none',
    'focus-visible:ring-3 focus-visible:ring-ring/50 motion-safe:transition-colors',
    selected
      ? 'border-primary bg-accent text-accent-foreground'
      : 'border-border bg-card hover:bg-muted',
  ].join(' ')

export function OnboardingQuiz({ onTrack, onCreate }: Props) {
  const [stepIndex, setStepIndex] = useState(0)
  const [answers, setAnswers] = useState<Answers>({})
  const [sessionId, setSessionId] = useState(newSessionId)
  const [status, setStatus] = useState<Status>('answering')
  const [plan, setPlan] = useState<Plan | null>(null)
  const [attempted, setAttempted] = useState(false)
  const [focusIndex, setFocusIndex] = useState(0)

  const headingRef = useRef<HTMLHeadingElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const trackChain = useRef<Promise<void>>(Promise.resolve())
  const started = useRef(false)
  const creating = useRef(false)
  const previousView = useRef<number | 'result'>(0)

  // Events are chained so a later step is never stored before an earlier one,
  // and a failing tracker can never break the quiz.
  function track(event: FunnelEventInput) {
    trackChain.current = trackChain.current.then(() => onTrack(event)).catch(() => {})
  }

  useEffect(() => {
    // StrictMode runs mount effects twice in development.
    if (started.current) return
    started.current = true
    track({ sessionId, type: 'quiz_started' })
    track({ sessionId, type: 'step_viewed', step: STEP_ORDER[0] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const view = status === 'answering' ? stepIndex : 'result'
  useEffect(() => {
    // Only a real view change moves focus; StrictMode's double effect run on
    // mount must not steal it.
    if (previousView.current === view) return
    previousView.current = view
    headingRef.current?.focus()
  }, [view])

  const stepId = STEP_ORDER[stepIndex]
  const step = getStep(stepId, answers)
  const selectedIds = step.multiple
    ? (answers.dias ?? []).map(String)
    : answers[stepId] === undefined
      ? []
      : [String(answers[stepId])]
  const selectedIndex = step.options.findIndex((o) => selectedIds.includes(o.id))
  const tabbableIndex = step.multiple ? focusIndex : Math.max(selectedIndex, 0)

  function goToStep(index: number) {
    setStepIndex(index)
    setAttempted(false)
    setFocusIndex(0)
    track({ sessionId, type: 'step_viewed', step: STEP_ORDER[index] })
  }

  function advance(current: Answers) {
    if (!isAnswered(stepId, current)) {
      setAttempted(true)
      return
    }
    track({ sessionId, type: 'step_answered', step: stepId, value: answerValue(stepId, current) })
    if (stepIndex < TOTAL - 1) {
      goToStep(stepIndex + 1)
      return
    }
    setPlan(buildPlan(current as QuizAnswers, new Date()))
    setStatus('result')
    track({ sessionId, type: 'result_viewed' })
  }

  function choose(optionId: string) {
    setAnswers((prev) => withAnswer(prev, stepId, optionId))
    setAttempted(false)
  }

  function moveFocus(index: number) {
    const count = step.options.length
    const target = (index + count) % count
    setFocusIndex(target)
    optionRefs.current[target]?.focus()
    if (!step.multiple) choose(step.options[target].id)
  }

  function onGroupKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const from = optionRefs.current.findIndex((el) => el === document.activeElement)
    if (from < 0) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault()
      moveFocus(from + 1)
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault()
      moveFocus(from - 1)
    } else if (event.key === 'Enter' && !step.multiple) {
      // Enter on a single-choice option selects it and continues.
      event.preventDefault()
      const next = withAnswer(answers, stepId, step.options[from].id)
      setAnswers(next)
      advance(next)
    }
  }

  function restart() {
    if (creating.current) return
    const next = newSessionId()
    setSessionId(next)
    setAnswers({})
    setPlan(null)
    setStepIndex(0)
    setAttempted(false)
    setFocusIndex(0)
    setStatus('answering')
    track({ sessionId: next, type: 'quiz_started' })
    track({ sessionId: next, type: 'step_viewed', step: STEP_ORDER[0] })
  }

  async function create() {
    // The server action has no double-submit guard, so re-entry is ignored
    // here until the previous call settles.
    if (creating.current) return
    creating.current = true
    setStatus('creating')
    try {
      await onCreate({ sessionId, answers: answers as QuizAnswers })
    } catch {
      creating.current = false
      setStatus('error')
    }
  }

  const progress = ((status === 'answering' ? stepIndex + 1 : TOTAL) / TOTAL) * 100

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-6">
      <div className="flex flex-col gap-2">
        {status === 'answering' && (
          <span className="text-sm text-muted-foreground">
            Etapa {stepIndex + 1} de {TOTAL}
          </span>
        )}
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div
            className="h-full rounded-full bg-gradient-to-r from-support to-primary motion-safe:transition-[width] motion-safe:duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {status === 'answering' ? (
        <div
          key={stepId}
          className="flex flex-col gap-5 motion-safe:transition-[opacity,transform] motion-safe:duration-200 starting:opacity-0 motion-safe:starting:translate-y-2"
        >
          <h1 id="quiz-step-heading" ref={headingRef} tabIndex={-1} className="text-2xl font-semibold outline-none">
            {step.title}
          </h1>

          <div
            role={step.multiple ? 'group' : 'radiogroup'}
            aria-labelledby="quiz-step-heading"
            className={step.multiple ? 'grid grid-cols-2 gap-2' : 'flex flex-col gap-2'}
            onKeyDown={onGroupKeyDown}
          >
            {step.options.map((option, i) => {
              const selected = selectedIds.includes(option.id)
              return (
                <button
                  key={option.id}
                  ref={(el) => {
                    optionRefs.current[i] = el
                  }}
                  type="button"
                  role={step.multiple ? 'checkbox' : 'radio'}
                  aria-checked={selected}
                  tabIndex={i === tabbableIndex ? 0 : -1}
                  className={optionClass(selected)}
                  onFocus={() => setFocusIndex(i)}
                  onClick={() =>
                    step.multiple
                      ? setAnswers((prev) => toggleDay(prev, option.id as Weekday))
                      : choose(option.id)
                  }
                >
                  {option.emoji && <span aria-hidden="true">{option.emoji}</span>}
                  <span>{option.label}</span>
                </button>
              )
            })}
          </div>

          {attempted && !isAnswered(stepId, answers) && (
            <p role="status" className="text-sm text-destructive">
              {step.multiple ? 'Escolha pelo menos um dia' : 'Escolha uma opção'}
            </p>
          )}

          <div className="flex items-center justify-between gap-3">
            {stepIndex > 0 ? (
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 px-4 text-base"
                onClick={() => goToStep(stepIndex - 1)}
              >
                ← Voltar
              </Button>
            ) : (
              <span />
            )}
            <Button type="button" className="min-h-11 px-6 text-base" onClick={() => advance(answers)}>
              Continuar
            </Button>
          </div>
        </div>
      ) : (
        plan && (
          <ResultView
            plan={plan}
            answers={answers as QuizAnswers}
            headingRef={headingRef}
            busy={status === 'creating'}
            failed={status === 'error'}
            onRestart={restart}
            onCreate={create}
          />
        )
      )}
    </div>
  )
}

function ResultView({
  plan,
  answers,
  headingRef,
  busy,
  failed,
  onRestart,
  onCreate,
}: {
  plan: Plan
  answers: QuizAnswers
  headingRef: React.RefObject<HTMLHeadingElement | null>
  busy: boolean
  failed: boolean
  onRestart: () => void
  onCreate: () => void
}) {
  const recurring = plan.weeks.find((w) => w.recurring)
  const partial = plan.weeks.find((w) => !w.recurring)
  const startsNextWeek =
    plan.weeks[0].weekStart.getTime() > getWeekBounds(plan.objective.startDate).weekStart.getTime()
  const months = answers.prazo === 1 ? '1 mês' : `${answers.prazo} meses`

  return (
    <div className="flex flex-col gap-5 motion-safe:transition-[opacity,transform] motion-safe:duration-200 starting:opacity-0 motion-safe:starting:translate-y-2">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-accent-foreground">Seu plano está pronto</span>
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold outline-none">
          {plan.objective.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          Meta para {formatDate(plan.objective.targetDate)} · {months}
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border border-l-[3px] border-l-support bg-card p-4">
        <div className="flex flex-col gap-1">
          <span className="font-medium">{plan.weeklyGoal.title}</span>
          <span className="w-fit rounded-full bg-support-muted px-2 py-0.5 text-[11px] font-medium text-support-foreground">
            repete toda semana
          </span>
        </div>
        <ul className="flex flex-col gap-1 text-sm">
          {recurring?.tasks.map((task) => (
            <li key={task.date.toISOString()}>{`${WEEKDAY_LABELS[weekdayOf(task.date)]} · ${task.title}`}</li>
          ))}
        </ul>
        {startsNextWeek && (
          <p className="text-sm text-muted-foreground">
            Começa na segunda, {formatDayMonth(plan.weeks[0].weekStart)}
          </p>
        )}
        {partial && (
          <p className="text-sm text-muted-foreground">
            Começa nesta semana com {partial.tasks.length} {partial.tasks.length === 1 ? 'tarefa' : 'tarefas'}
          </p>
        )}
      </div>

      <p className="text-sm">{plan.tip}</p>

      {failed && (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível criar o plano. Tente de novo.
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="ghost" className="min-h-11 px-4 text-base" disabled={busy} onClick={onRestart}>
          Refazer
        </Button>
        <Button
          type="button"
          className="min-h-11 px-6 text-base aria-disabled:pointer-events-none aria-disabled:opacity-50"
          // aria-disabled instead of disabled keeps focus on the button while creating.
          aria-disabled={busy}
          aria-busy={busy}
          onClick={onCreate}
        >
          {busy ? (
            <>
              <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />
              Criando…
            </>
          ) : (
            'Criar meu plano'
          )}
        </Button>
      </div>
    </div>
  )
}
