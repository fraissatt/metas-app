'use client'

import { useRef, useState, useSyncExternalStore, useTransition } from 'react'
import { ArrowUp, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export type QuickAddGoal = { id: string; title: string }

const STORAGE_KEY = 'metas:quick-add-goal'

// Only a per-browser convenience, so every access tolerates a blocked store.
function readLastGoal(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

// Safari and iOS Safari do not focus a button when it is tapped, so the field
// would lose focus (and the options would close) before the tap lands.
const keepFocus = (event: React.MouseEvent) => event.preventDefault()

function subscribeStorage(onChange: () => void): () => void {
  window.addEventListener('storage', onChange)
  return () => window.removeEventListener('storage', onChange)
}

function rememberGoal(id: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // Not remembered; the next visit starts from the default goal.
  }
}

/**
 * The quick entry on Hoje: write a task, press Enter, and it lands in today's
 * list in one of this week's goals. `goals` come in the order to offer them
 * (the ones that already have tasks today first), so the first is the default
 * unless the person chose another one earlier on this browser.
 */
export function QuickAddTask({
  goals,
  onAdd,
}: {
  goals: QuickAddGoal[]
  onAdd: (weeklyGoalId: string, title: string) => Promise<void>
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState('')
  const [choice, setChoice] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)
  const [failed, setFailed] = useState(false)
  const [, startTransition] = useTransition()

  // Read through useSyncExternalStore: the server and the first client render
  // see no remembered goal, so hydration matches, and the browser's choice
  // takes over right after.
  const remembered = useSyncExternalStore(subscribeStorage, readLastGoal, () => null)
  const known = (id: string | null) => goals.find((goal) => goal.id === id)?.id
  const selectedId = known(choice) ?? known(remembered) ?? goals[0]?.id
  const selected = goals.find((goal) => goal.id === selectedId)
  const canChoose = goals.length > 1
  const canSubmit = title.trim().length > 0 && selectedId !== undefined

  function pick(id: string) {
    setChoice(id)
    rememberGoal(id)
    inputRef.current?.focus()
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit || !selectedId) return

    // Emptied and refocused before the request, so the next task can be typed
    // while this one is saved; on failure the text comes back unless the
    // person has already started another.
    const submitted = title
    setFailed(false)
    setTitle('')
    inputRef.current?.focus()
    startTransition(async () => {
      try {
        await onAdd(selectedId, submitted)
      } catch {
        setTitle((current) => (current === '' ? submitted : current))
        setFailed(true)
      }
    })
  }

  if (!selected) return null

  return (
    <form
      onSubmit={submit}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false)
      }}
      className="mb-4 flex flex-col rounded-lg border border-border bg-card transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 motion-reduce:transition-none"
    >
      <div className="flex items-center gap-2.5 py-1.5 pr-1.5 pl-3.5">
        <Plus aria-hidden="true" className={cn('size-[18px] shrink-0', focused ? 'text-primary' : 'text-muted-foreground')} />
        <label htmlFor="quick-add-title" className="sr-only">
          Nova tarefa para hoje
        </label>
        <input
          ref={inputRef}
          id="quick-add-title"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value)
            setFailed(false)
          }}
          placeholder="O que você vai fazer hoje?"
          autoComplete="off"
          enterKeyHint="send"
          maxLength={200}
          onKeyDown={(event) => {
            // Enter that confirms an IME composition must not submit the task.
            if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault()
          }}
          className="min-w-0 flex-1 bg-transparent py-1.5 text-base outline-none placeholder:text-muted-foreground md:text-sm"
        />
        {/* The goal that will receive the task: hidden while the options are open, but
            with a single goal there are none, so it stays as information. */}
        {(!canChoose || (!focused && !title)) && (
          <span className="hidden max-w-[45%] truncate rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground sm:block">
            {selected.title}
          </span>
        )}
        {(focused || title) && (
          <button
            type="submit"
            disabled={!canSubmit}
            onMouseDown={keepFocus}
            aria-label="Adicionar tarefa"
            className="inline-flex size-8 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground transition-colors outline-none hover:bg-primary/85 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:bg-muted disabled:text-muted-foreground sm:h-8 sm:w-auto sm:rounded-lg sm:px-3 sm:text-sm sm:font-semibold"
          >
            <ArrowUp aria-hidden="true" className="size-4 sm:hidden" />
            <span aria-hidden="true" className="hidden sm:inline">
              Adicionar
            </span>
            <kbd aria-hidden="true" className="hidden rounded bg-black/15 px-1.5 font-mono text-[10px] font-medium sm:inline">
              Enter
            </kbd>
          </button>
        )}
      </div>

      {canChoose && (focused || title) && (
        <div className="flex flex-col gap-2 border-t border-border px-3.5 pt-2.5 pb-3">
          <span id="quick-add-goal-label" className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Em qual meta
          </span>
          <div role="group" aria-labelledby="quick-add-goal-label" onMouseDown={keepFocus} className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden">
            {goals.map((goal) => (
              <button
                key={goal.id}
                type="button"
                aria-pressed={goal.id === selectedId}
                onClick={() => pick(goal.id)}
                className={cn(
                  'shrink-0 rounded-full border px-2.5 py-1 text-xs whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                  goal.id === selectedId
                    ? 'border-transparent bg-accent font-medium text-accent-foreground'
                    : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {goal.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {failed && (
        <p role="alert" className="border-t border-border px-3.5 py-2 text-xs text-destructive">
          Não deu para adicionar. Tente de novo.
        </p>
      )}
    </form>
  )
}
