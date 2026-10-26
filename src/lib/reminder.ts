import { DONE_THRESHOLD, type TaskDay } from '@/lib/day-dots'

export type ReminderMessage = { title: string; body: string; url: string }

/** Tasks still to tick for today to count as a done day (60% of what was planned). */
export function tasksToDayDone(today: TaskDay[]): number {
  const completed = today.filter((task) => task.completed).length
  return Math.max(0, Math.ceil(today.length * DONE_THRESHOLD) - completed)
}

/**
 * The evening reminder, or null when there is nothing to remind: no tasks
 * planned for today, or today already counts as a done day. The message is a
 * result within reach — how many tasks make today the next done day — not
 * encouragement.
 */
export function buildReminder(today: TaskDay[], daysDoneBefore: number): ReminderMessage | null {
  if (today.length === 0) return null
  const missing = tasksToDayDone(today)
  if (missing === 0) return null

  const tasks = missing === 1 ? 'Mais 1 tarefa' : `Mais ${missing} tarefas`
  return {
    title: 'Metas',
    body: `${tasks} e hoje vira seu ${daysDoneBefore + 1}º dia feito.`,
    url: '/',
  }
}
