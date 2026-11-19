import { isGoalFulfilled } from '@/lib/objectives'

/** A small win worth a quiet word: what the person reads when it happens. */
export type Moment = { title: string; body: string }

type GoalLike = { id: string; title: string; dailyTasks: Array<{ completed: boolean }> }

/**
 * The moment (if any) that a change to the week's goals just created. Only a
 * transition counts: a goal or a week that was already closed stays quiet, so
 * nothing is celebrated on a reload or when an unrelated task is ticked.
 *
 * The whole week wins over a single goal: closing the last goal closes the
 * week, and one message is enough.
 */
export function weekMoment(before: GoalLike[], after: GoalLike[]): Moment | null {
  const wasFulfilled = new Map(before.map((goal) => [goal.id, isGoalFulfilled(goal.dailyTasks)]))
  const closedNow = after.filter((goal) => isGoalFulfilled(goal.dailyTasks) && wasFulfilled.get(goal.id) === false)
  if (closedNow.length === 0) return null

  // Goals with no tasks yet are not "open work": they don't hold the week back.
  const planned = after.filter((goal) => goal.dailyTasks.length > 0)
  if (planned.every((goal) => isGoalFulfilled(goal.dailyTasks))) {
    return {
      title: 'Semana fechada',
      body:
        planned.length === 1
          ? 'Sua meta desta semana está cumprida. Descanse sem culpa.'
          : `As ${planned.length} metas desta semana estão cumpridas. Descanse sem culpa.`,
    }
  }

  return {
    title: 'Meta da semana fechada',
    body: `“${closedNow[0].title}” está cumprida. Um passo de cada vez.`,
  }
}

export function objectiveMoment(title?: string): Moment {
  return {
    title: 'Objetivo concluído',
    body: title
      ? `Você chegou em “${title}”. Ele fica guardado em Concluídos.`
      : 'Você chegou. Ele fica guardado em Concluídos.',
  }
}
