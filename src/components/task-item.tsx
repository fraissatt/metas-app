'use client'

import { useState } from 'react'
import { Menu } from '@base-ui/react/menu'
import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DeleteConfirmDialog } from '@/components/delete-button'
import { SubmitButton } from '@/components/submit-button'
import { TaskToggle } from '@/components/task-toggle'
import { appDayOfMonth, formatDayKey, formatDayMonth, getWeekDays } from '@/lib/dates'
import { cn } from '@/lib/utils'

const DAY_LABELS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM']

const itemClass =
  'px-2 py-1.5 text-sm rounded-sm cursor-default outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground'

type Task = { id: string; title: string; date: Date; completed: boolean }

/**
 * One task row: checkbox + title, and a "⋯" menu to edit it in place or
 * delete it. The day picker only offers the days of the task's week, since
 * a task belongs to one weekly goal.
 */
export function TaskItem({
  task,
  weekStart,
  showDate = false,
  className,
  onToggle,
  onUpdate,
  onDelete,
}: {
  task: Task
  weekStart: Date
  showDate?: boolean
  className?: string
  onToggle: (id: string) => Promise<void>
  onUpdate: (id: string, formData: FormData) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [failed, setFailed] = useState(false)

  if (editing) {
    return (
      <form
        className={cn('flex flex-col gap-2 py-2', className)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setEditing(false)
        }}
        action={async (formData) => {
          setFailed(false)
          try {
            await onUpdate(task.id, formData)
            setEditing(false)
          } catch {
            setFailed(true)
          }
        }}
      >
        <div className="flex gap-2">
          <Input
            name="title"
            aria-label="Nome da tarefa"
            defaultValue={task.title}
            autoComplete="off"
            required
            autoFocus
            className="flex-1"
          />
          <select
            name="date"
            aria-label="Dia da tarefa"
            defaultValue={formatDayKey(task.date)}
            className="rounded-md border border-border bg-secondary px-2 text-sm text-foreground"
          >
            {getWeekDays(weekStart).map((day, index) => (
              <option key={day.toISOString()} value={formatDayKey(day)}>
                {DAY_LABELS[index]} {String(appDayOfMonth(day)).padStart(2, '0')}
              </option>
            ))}
          </select>
        </div>
        {failed && (
          <p role="alert" className="text-xs text-destructive">
            Não foi possível salvar. Tente de novo.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
          <SubmitButton size="sm">Salvar</SubmitButton>
        </div>
      </form>
    )
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {showDate && (
        <span className="w-10 shrink-0 text-xs text-muted-foreground tabular-nums">{formatDayMonth(task.date)}</span>
      )}
      {/* A wrapping label makes the title part of the checkbox's hit target. */}
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
        <TaskToggle taskId={task.id} completed={task.completed} action={onToggle} />
        <span className={cn('min-w-0 break-words text-sm', task.completed && 'text-muted-foreground line-through')}>
          {task.title}
        </span>
      </label>
      <Menu.Root>
        <Menu.Trigger
          aria-label={`Ações de ${task.title}`}
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MoreHorizontal className="size-4" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner align="end" sideOffset={4} className="z-50">
            <Menu.Popup className="bg-popover text-popover-foreground border border-border rounded-md p-1 shadow-md min-w-32">
              <Menu.Item className={itemClass} onClick={() => setEditing(true)}>
                Editar
              </Menu.Item>
              <Menu.Item className={`${itemClass} text-destructive`} onClick={() => setConfirmDelete(true)}>
                Excluir…
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <DeleteConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        action={() => onDelete(task.id)}
      />
    </div>
  )
}
