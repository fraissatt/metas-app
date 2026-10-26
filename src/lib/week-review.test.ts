import { describe, expect, it } from 'vitest'
import { compoundFactor } from '@/lib/day-dots'
import { formatDayKey, parseDay } from '@/lib/dates'
import {
  ASSUMED_DAYS_PER_WEEK,
  PROJECTION_WEEKS,
  buildWeekReview,
  isInviteDue,
  pickReviewWeek,
  repeatTargetWeek,
  type ReviewGoalInput,
} from '@/lib/week-review'

// The week of 2026-10-19 (Monday) to 2026-10-25 (Sunday).
const MONDAY = parseDay('2026-10-19')
const at = (key: string, hour = 12) => new Date(`${key}T${String(hour).padStart(2, '0')}:00:00-03:00`)
const task = (key: string, completed: boolean) => ({ date: parseDay(key), completed })

function goal(overrides: Partial<ReviewGoalInput> = {}): ReviewGoalInput {
  return {
    id: 'g1',
    title: 'Correr 3x',
    objectiveTitle: 'Saúde',
    recurring: false,
    objectiveCompleted: false,
    alreadyPlanned: false,
    tasks: [],
    ...overrides,
  }
}

describe('pickReviewWeek', () => {
  it('reviews the current week on Saturday and Sunday when it has goals', () => {
    for (const day of ['2026-10-24', '2026-10-25']) {
      const week = pickReviewWeek(at(day), { currentWeekHasGoals: true, lastPlannedWeekStart: parseDay('2026-10-12') })
      expect(week && formatDayKey(week.weekStart)).toBe('2026-10-19')
      expect(week?.repeatInto).toBe('next')
    }
  })

  it('reviews the last planned week on weekdays', () => {
    const week = pickReviewWeek(at('2026-10-22'), {
      currentWeekHasGoals: true,
      lastPlannedWeekStart: parseDay('2026-10-05'),
    })
    expect(week && formatDayKey(week.weekStart)).toBe('2026-10-05')
    expect(week?.repeatInto).toBe('current')
  })

  it('falls back to the last planned week on a weekend with an empty current week', () => {
    const week = pickReviewWeek(at('2026-10-25'), { currentWeekHasGoals: false, lastPlannedWeekStart: parseDay('2026-10-12') })
    expect(week && formatDayKey(week.weekStart)).toBe('2026-10-12')
    expect(week?.repeatInto).toBe('current')
  })

  it('has nothing to review without any planned week', () => {
    expect(pickReviewWeek(at('2026-10-21'), { currentWeekHasGoals: true, lastPlannedWeekStart: null })).toBeNull()
  })

  it('uses Brasília days: Friday 22:00 in Brasília is already Saturday in UTC but still a weekday', () => {
    const week = pickReviewWeek(at('2026-10-23', 22), { currentWeekHasGoals: true, lastPlannedWeekStart: parseDay('2026-10-12') })
    expect(week?.repeatInto).toBe('current')
  })
})

describe('isInviteDue', () => {
  it('invites on the weekend for the current week', () => {
    expect(isInviteDue(at('2026-10-24'), { weekStart: MONDAY, repeatInto: 'next' })).toBe(true)
  })

  it('invites Monday to Wednesday for the previous calendar week only', () => {
    const previous = { weekStart: MONDAY, repeatInto: 'current' as const }
    expect(isInviteDue(at('2026-10-26'), previous)).toBe(true)
    expect(isInviteDue(at('2026-10-28'), previous)).toBe(true)
    expect(isInviteDue(at('2026-10-29'), previous)).toBe(false)
    expect(isInviteDue(at('2026-11-02'), previous)).toBe(false)
  })
})

describe('repeatTargetWeek', () => {
  it('sends the current week to the next one', () => {
    expect(formatDayKey(repeatTargetWeek(at('2026-10-25'), MONDAY).weekStart)).toBe('2026-10-26')
  })

  it('sends an earlier week to the current one', () => {
    expect(formatDayKey(repeatTargetWeek(at('2026-10-27'), MONDAY).weekStart)).toBe('2026-10-26')
    expect(formatDayKey(repeatTargetWeek(at('2026-11-10'), MONDAY).weekStart)).toBe('2026-11-09')
  })
})

describe('buildWeekReview', () => {
  const week = { weekStart: MONDAY, repeatInto: 'current' as const }
  const now = at('2026-10-26')

  it('counts days done and tasks, and compares with the week before', () => {
    const review = buildWeekReview({
      week,
      now,
      goals: [
        goal({
          tasks: [task('2026-10-19', true), task('2026-10-20', true), task('2026-10-21', false), task('2026-10-22', true)],
        }),
      ],
      previousWeekTasks: [task('2026-10-12', true), task('2026-10-13', false)],
      daysDoneBefore: 10,
      reviewedAt: null,
    })

    expect(review.weekKey).toBe('2026-10-19')
    expect(review.rangeLabel).toBe('19 a 25 de out.')
    expect(review.dots.map((dot) => dot.tone)).toEqual(['done', 'done', 'empty', 'done', 'empty', 'empty', 'empty'])
    expect(review.daysDone).toBe(3)
    expect(review.tasksCompleted).toBe(3)
    expect(review.tasksTotal).toBe(4)
    expect(review.previousDelta).toBe(2)
    expect(review.compound).toEqual({ before: compoundFactor(10), after: compoundFactor(13) })
    expect(review.projection).toEqual({
      daysPerWeek: 3,
      assumed: false,
      from: compoundFactor(13),
      to: compoundFactor(13 + 3 * PROJECTION_WEEKS),
    })
  })

  it('leaves out the comparison when the week before had no tasks', () => {
    const review = buildWeekReview({ week, now, goals: [goal()], previousWeekTasks: [], daysDoneBefore: 0, reviewedAt: null })
    expect(review.previousDelta).toBeNull()
  })

  it('projects an assumed pace when the week had no day done', () => {
    const review = buildWeekReview({
      week,
      now,
      goals: [goal({ tasks: [task('2026-10-19', false)] })],
      previousWeekTasks: [],
      daysDoneBefore: 5,
      reviewedAt: null,
    })
    expect(review.projection).toEqual({
      daysPerWeek: ASSUMED_DAYS_PER_WEEK,
      assumed: true,
      from: compoundFactor(5),
      to: compoundFactor(5 + ASSUMED_DAYS_PER_WEEK * PROJECTION_WEEKS),
    })
  })

  it('says what can happen to each goal, ordered by objective then title', () => {
    const review = buildWeekReview({
      week,
      now,
      goals: [
        goal({ id: 'choose', title: 'Ler', objectiveTitle: 'B', tasks: [task('2026-10-19', true)] }),
        goal({ id: 'recurring', title: 'Alongar', objectiveTitle: 'B', recurring: true }),
        goal({ id: 'planned', title: 'Correr', objectiveTitle: 'A', alreadyPlanned: true }),
        goal({ id: 'closed', title: 'Zerar', objectiveTitle: 'A', recurring: true, objectiveCompleted: true }),
      ],
      previousWeekTasks: [],
      daysDoneBefore: 0,
      reviewedAt: null,
    })

    expect(review.goals.map((row) => [row.id, row.repeat])).toEqual([
      ['planned', 'planned'],
      ['closed', 'closed'],
      ['recurring', 'recurring'],
      ['choose', 'choose'],
    ])
    expect(review.goals[3]).toMatchObject({ completed: 1, total: 1, fulfilled: true })
  })

  it('formats when the week was reviewed', () => {
    const review = buildWeekReview({
      week,
      now,
      goals: [],
      previousWeekTasks: [],
      daysDoneBefore: 0,
      reviewedAt: at('2026-10-26', 20),
    })
    expect(review.reviewedOn).toBe('26/10')
  })
})
