import Link from 'next/link'
import { isSameDay } from 'date-fns'
import type { DailyTask, Objective, WeeklyGoal } from '@prisma/client'
import { getWeekDays } from '@/lib/dates'
import { isGoalFulfilled } from '@/lib/objectives'
import { cn } from '@/lib/utils'

const DAY_LABELS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM']
const RING_RADIUS = 16
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

export function WeekGoalProgressCard({
  goal,
}: {
  goal: WeeklyGoal & { objective: Objective; dailyTasks: DailyTask[] }
}) {
  const total = goal.dailyTasks.length
  const completed = goal.dailyTasks.filter((t) => t.completed).length
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100)
  const ringOffset = RING_CIRCUMFERENCE - (percent / 100) * RING_CIRCUMFERENCE
  const fulfilled = isGoalFulfilled(goal.dailyTasks)

  return (
    <div
      className={cn(
        'flex overflow-hidden rounded-lg border transition-colors motion-reduce:transition-none',
        fulfilled ? 'border-primary bg-accent' : 'border-border',
      )}
    >
      <div className="w-[3px] shrink-0 bg-primary" />
      <div className="flex-1 p-4">
        <div className="mb-3 flex min-w-0 flex-col text-left">
          <Link
            href={`/objectives/${goal.objective.id}/weeks/${goal.id}`}
            className="text-sm font-semibold break-words hover:text-primary hover:underline"
          >
            {goal.title}
          </Link>
          <Link
            href={`/objectives/${goal.objective.id}`}
            className="text-xs break-words text-muted-foreground hover:text-primary hover:underline"
          >
            {goal.objective.title}
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
            <svg width="40" height="40" viewBox="0 0 40 40" className="-rotate-90">
              <circle cx="20" cy="20" r={RING_RADIUS} fill="none" stroke="var(--muted)" strokeWidth="4" />
              <circle
                cx="20"
                cy="20"
                r={RING_RADIUS}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={ringOffset}
                data-testid="progress-ring"
                className="transition-[stroke-dashoffset] duration-300 ease-in-out motion-reduce:transition-none"
              />
            </svg>
            <span className="absolute text-[10px] font-semibold tabular-nums">{percent}%</span>
          </div>

          <div className="flex h-6 flex-1 items-end gap-1">
            {getWeekDays(goal.weekStart).map((day, i) => {
              const dayTasks = goal.dailyTasks.filter((t) => isSameDay(t.date, day))
              const dayCompleted = dayTasks.filter((t) => t.completed).length
              const dayTotal = dayTasks.length
              const heightPercent = dayTotal === 0 ? 8 : Math.max(8, Math.round((dayCompleted / dayTotal) * 100))

              return (
                <div
                  key={day.toISOString()}
                  title={`${DAY_LABELS[i]}: ${dayCompleted}/${dayTotal} tarefas`}
                  className="flex-1 rounded-t-sm bg-primary transition-[height] duration-300 ease-in-out motion-reduce:transition-none"
                  style={{ height: `${heightPercent}%`, opacity: dayTotal === 0 ? 0.3 : 1 }}
                />
              )
            })}
          </div>
        </div>

        {/* The ring's own `stroke-dashoffset` transition already animates it to
            full; this is the part that names what just happened. */}
        {fulfilled ? (
          <div role="status" className="mt-2 flex flex-col items-start gap-1">
            <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
              ✓ concluída
            </span>
            <span className="text-xs font-medium text-primary">Meta da semana fechada <span aria-hidden="true">🎯</span></span>
          </div>
        ) : (
          <span className="mt-2 block text-sm text-muted-foreground tabular-nums">
            {completed}/{total} tarefas
          </span>
        )}
      </div>
    </div>
  )
}
