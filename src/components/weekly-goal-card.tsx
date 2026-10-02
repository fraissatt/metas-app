'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox'
import { format, isSameDay } from 'date-fns'
import type { DailyTask } from '@prisma/client'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DeleteButton } from '@/components/delete-button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { SubmitButton } from '@/components/submit-button'
import { WeeklyGoalDayChart } from '@/components/weekly-goal-day-chart'
import { getWeekDays, formatDayMonth } from '@/lib/dates'
import type { WeeklyGoalWithTasks } from '@/lib/actions/weeklyGoals'

const DAY_LABELS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM']

function computeProgress(tasks: DailyTask[]): { total: number; completed: number; percent: number } {
  const total = tasks.length
  const completed = tasks.filter((t) => t.completed).length
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100)
  return { total, completed, percent }
}

export function WeeklyGoalCard({
  goal,
  expanded,
  onToggleExpand,
  onCreateTasks,
  onDelete,
}: {
  goal: WeeklyGoalWithTasks
  expanded: boolean
  onToggleExpand: () => void
  onCreateTasks: (formData: FormData) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const days = getWeekDays(goal.weekStart)
  const today = new Date()
  const { total, completed, percent } = computeProgress(goal.dailyTasks)
  const [checkedCount, setCheckedCount] = useState(() => days.filter((day) => isSameDay(day, today)).length)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>
          <Link href={`/objectives/${goal.objectiveId}/weeks/${goal.id}`}>{goal.title}</Link>
        </CardTitle>
        {goal.recurring && (
          <span className="w-fit rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            repete toda semana
          </span>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Progress value={percent} />
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground tabular-nums">
            {completed}/{total} tarefas ({percent}%)
          </span>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="secondary"
              nativeButton={false}
              render={<Link href={`/objectives/${goal.objectiveId}/weeks/${goal.id}/edit`} />}
            >
              Editar
            </Button>
            <DeleteButton
              action={onDelete}
              confirmDescription="Isso também excluirá todas as tarefas diárias desta meta. Esta ação não pode ser desfeita."
            />
          </div>
        </div>

        <form action={onCreateTasks} className="flex flex-col gap-2">
          <Input name="title" aria-label="Nova tarefa" placeholder="Nova tarefa…" autoComplete="off" required />
          <div className="flex gap-1.5">
            {days.map((day, index) => {
              const iso = format(day, 'yyyy-MM-dd')
              const label = `${DAY_LABELS[index]} ${format(day, 'd')}`
              return (
                <CheckboxPrimitive.Root
                  key={iso}
                  name="dates"
                  value={iso}
                  defaultChecked={isSameDay(day, today)}
                  onCheckedChange={(checked) => setCheckedCount((count) => count + (checked ? 1 : -1))}
                  aria-label={label}
                  className="flex flex-1 flex-col items-center justify-center rounded-md border border-border bg-secondary px-1 py-1.5 text-[11px] text-muted-foreground transition-colors data-checked:border-primary data-checked:bg-accent data-checked:text-accent-foreground"
                >
                  <span aria-hidden="true">{DAY_LABELS[index]}</span>
                  <span aria-hidden="true" className="font-medium">
                    {format(day, 'd')}
                  </span>
                </CheckboxPrimitive.Root>
              )
            })}
          </div>
          <SubmitButton size="sm" className="self-end" disabled={checkedCount === 0}>
            Criar
          </SubmitButton>
        </form>

        <Button type="button" variant="ghost" size="sm" onClick={onToggleExpand} aria-expanded={expanded}>
          {expanded ? 'Ver menos' : 'Ver detalhes'}
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </Button>

        {expanded && (
          <div className="flex flex-col gap-3 border-t border-border pt-3">
            <WeeklyGoalDayChart weekStart={goal.weekStart} tasks={goal.dailyTasks} />
            <ul className="flex flex-col gap-1">
              {goal.dailyTasks.map((task) => (
                <li
                  key={task.id}
                  className={`text-sm ${task.completed ? 'text-muted-foreground line-through' : ''}`}
                >
                  {formatDayMonth(task.date)} · {task.title}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
