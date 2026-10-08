import { describe, expect, it } from 'vitest'
import { buildPlan, TEMPLATES } from './build-plan'
import { getStep, type Obstacle, type QuizAnswers } from './definition'
import { formatDayKey } from '@/lib/dates'

// Thursday; the week starts on Monday 2026-09-28.
const today = new Date('2026-10-01T15:00:00-03:00')
const ymd = (d: Date) => formatDayKey(d)

const base: QuizAnswers = {
  area: 'saude',
  foco: 'correr',
  prazo: 3,
  dias: ['qui', 'sex', 'sab'],
  obstaculo: 'constancia',
}

describe('buildPlan', () => {
  it('works for every area and focus', () => {
    for (const area of ['saude', 'estudos', 'financas', 'carreira'] as const) {
      for (const option of getStep('foco', { area }).options) {
        const plan = buildPlan({ ...base, area, foco: option.id as QuizAnswers['foco'] }, today)
        expect(plan.objective.title).toBeTruthy()
        expect(plan.weeklyGoal.title).toContain('3')
        expect(plan.weeks.length).toBeGreaterThan(0)
      }
    }
  })

  it('sets target date to today plus the prazo months', () => {
    const plan = buildPlan(base, today)
    expect(ymd(plan.objective.targetDate)).toBe('2027-01-01')
    expect(ymd(plan.objective.startDate)).toBe('2026-10-01')
  })

  it('puts everything in one recurring week when all days are ahead', () => {
    const plan = buildPlan(base, today)
    expect(plan.weeks).toHaveLength(1)
    expect(plan.weeks[0].recurring).toBe(true)
    expect(ymd(plan.weeks[0].weekStart)).toBe('2026-09-28')
    expect(plan.weeks[0].tasks.map((t) => ymd(t.date))).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
    ])
    expect(plan.weeklyGoal.title).toContain('3')
  })

  it('splits into a partial and a recurring week when some days passed', () => {
    const plan = buildPlan({ ...base, dias: ['seg', 'qua', 'sab'] }, today)
    expect(plan.weeks).toHaveLength(2)
    const [first, second] = plan.weeks
    expect(ymd(first.weekStart)).toBe('2026-09-28')
    expect(first.recurring).toBe(false)
    expect(first.tasks.map((t) => ymd(t.date))).toEqual(['2026-10-03'])
    expect(ymd(second.weekStart)).toBe('2026-10-05')
    expect(second.recurring).toBe(true)
    expect(second.tasks.map((t) => ymd(t.date))).toEqual(['2026-10-05', '2026-10-07', '2026-10-10'])
    expect(plan.weeklyGoal.title).toContain('3')
  })

  it('plans only next week when no chosen day is left', () => {
    const plan = buildPlan({ ...base, dias: ['seg', 'ter'] }, today)
    expect(plan.weeks).toHaveLength(1)
    expect(ymd(plan.weeks[0].weekStart)).toBe('2026-10-05')
    expect(plan.weeks[0].recurring).toBe(true)
    expect(plan.weeks[0].tasks.map((t) => ymd(t.date))).toEqual(['2026-10-05', '2026-10-06'])
  })

  it('uses the short variant only for the tempo obstacle', () => {
    const dias: QuizAnswers['dias'] = ['qui', 'sex', 'sab']
    const short = buildPlan({ ...base, dias, obstaculo: 'tempo' }, today)
    for (const t of short.weeks.flatMap((w) => w.tasks)) expect(t.title).toContain('min')
    const normal = buildPlan({ ...base, dias, obstaculo: 'constancia' }, today)
    const shortTitles = new Set(TEMPLATES.correr.shortTasks)
    for (const t of normal.weeks.flatMap((w) => w.tasks)) expect(shortTitles.has(t.title)).toBe(false)
  })

  it('rotates task titles over more days than titles', () => {
    const plan = buildPlan(
      { ...base, dias: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'] },
      new Date('2026-10-05T09:00:00-03:00'),
    )
    const titles = plan.weeks[0].tasks.map((t) => t.title)
    expect(titles).toHaveLength(7)
    expect(titles[0]).toBe(titles[TEMPLATES.correr.tasks.length])
  })

  it('returns the spec tip for each obstacle', () => {
    const tips: Record<Obstacle, string> = {
      tempo: 'Como seu obstáculo é tempo, as tarefas são curtas.',
      constancia: 'A meta se repete toda semana para virar hábito.',
      comeco: 'As primeiras tarefas são simples para você começar hoje.',
      motivacao: 'Cada semana cumprida vira uma sequência 🔥 no painel.',
    }
    for (const [obstaculo, tip] of Object.entries(tips)) {
      expect(buildPlan({ ...base, obstaculo: obstaculo as Obstacle }, today).tip).toBe(tip)
    }
  })
})
