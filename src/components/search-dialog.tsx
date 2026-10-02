'use client'

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { formatDayMonth } from '@/lib/dates'
import { normalizeQuery, type SearchResults } from '@/lib/search'
import { cn } from '@/lib/utils'

type Option = { key: string; href: string; title: string; detail?: string; completed?: boolean }
type Response = { query: string; results?: SearchResults; failed?: boolean }

const DEBOUNCE_MS = 150

function toOptions(results: SearchResults) {
  const objectives: Option[] = results.objectives.map((o) => ({
    key: `o-${o.id}`,
    href: `/objectives/${o.id}`,
    title: o.title,
    completed: o.completed,
  }))
  const weeklyGoals: Option[] = results.weeklyGoals.map((g) => ({
    key: `w-${g.id}`,
    href: `/objectives/${g.objectiveId}/weeks/${g.id}`,
    title: g.title,
    detail: `${g.objectiveTitle} · semana de ${formatDayMonth(g.weekStart)}`,
  }))
  return { objectives, weeklyGoals, all: [...objectives, ...weeklyGoals] }
}

const subscribeNoop = () => () => {}
function useIsMac() {
  return useSyncExternalStore(
    subscribeNoop,
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => false,
  )
}

export function SearchDialog({ onSearch }: { onSearch: (query: string) => Promise<SearchResults> }) {
  const router = useRouter()
  const isMac = useIsMac()
  const listboxId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [response, setResponse] = useState<Response | null>(null)
  const [active, setActive] = useState(0)
  const latest = useRef(0)

  const normalized = normalizeQuery(query)

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setResponse(null)
    setActive(0)
  }, [])

  // Lets the global shortcut read the current state without re-subscribing.
  const openRef = useRef(open)
  useEffect(() => {
    openRef.current = open
  }, [open])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        if (openRef.current) close()
        else setOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [close])

  useEffect(() => {
    const id = ++latest.current
    if (!normalized) return
    const timer = setTimeout(async () => {
      try {
        const results = await onSearch(normalized)
        if (id === latest.current) {
          setResponse({ query: normalized, results })
          setActive(0)
        }
      } catch {
        if (id === latest.current) setResponse({ query: normalized, failed: true })
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [normalized, onSearch])

  // Only a response for exactly what is typed now is ever shown.
  const current = normalized && response?.query === normalized ? response : null
  const groups = current?.results ? toOptions(current.results) : null
  const options = groups?.all ?? []

  function go(option: Option) {
    router.push(option.href)
    close()
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (options.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((i) => (i + 1) % options.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => (i - 1 + options.length) % options.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      go(options[active])
    }
  }

  const status = !normalized
    ? 'Digite pelo menos 2 letras'
    : current?.failed
      ? 'Não foi possível buscar agora.'
      : groups && options.length === 0
        ? `Nada encontrado para “${normalized}”`
        : groups
          ? `${options.length} ${options.length === 1 ? 'resultado' : 'resultados'}`
          : ''

  function renderGroup(title: string, items: Option[]) {
    if (items.length === 0) return null
    return (
      <div role="group" aria-label={title}>
        <p className="px-2 pt-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground" aria-hidden="true">
          {title}
        </p>
        {items.map((option) => {
          const index = options.indexOf(option)
          const optionId = `${listboxId}-${index}`
          // The accessible name is the title (plus the "concluído" badge); the
          // parent objective and week are the description, so a weekly goal's
          // name does not also match its objective's title.
          return (
            <div
              key={option.key}
              id={optionId}
              role="option"
              aria-labelledby={option.completed ? `${optionId}-title ${optionId}-badge` : `${optionId}-title`}
              aria-describedby={option.detail ? `${optionId}-detail` : undefined}
              aria-selected={index === active}
              onMouseEnter={() => setActive(index)}
              onClick={() => go(option)}
              className={cn(
                'flex cursor-pointer flex-col rounded-md px-2 py-1.5',
                index === active && 'bg-accent text-accent-foreground',
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span id={`${optionId}-title`} className="truncate font-medium">
                  {option.title}
                </span>
                {option.completed && (
                  <span id={`${optionId}-badge`} className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                    concluído
                  </span>
                )}
              </span>
              {option.detail && (
                <span id={`${optionId}-detail`} className="truncate text-xs text-muted-foreground">
                  {option.detail}
                </span>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-8 w-56 items-center gap-2 rounded-lg border border-border bg-card px-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground md:flex"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Buscar…</span>
        <kbd className="rounded border border-border px-1.5 text-[11px]">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
      </button>
      <button
        type="button"
        aria-label="Buscar"
        onClick={() => setOpen(true)}
        className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground md:hidden"
      >
        <Search className="size-5" />
      </button>

      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <DialogContent className="top-[20%] translate-y-0 gap-2 sm:max-w-lg" showCloseButton={false}>
          <DialogTitle className="sr-only">Buscar</DialogTitle>
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              role="combobox"
              aria-expanded={options.length > 0}
              aria-controls={listboxId}
              aria-activedescendant={options.length > 0 ? `${listboxId}-${active}` : undefined}
              aria-label="Buscar objetivos e metas"
              autoComplete="off"
              placeholder="Buscar objetivos e metas…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onInputKeyDown}
              className="h-9 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm"
            />
          </div>
          <div id={listboxId} role="listbox" aria-label="Resultados" className="max-h-80 overflow-y-auto">
            {groups && renderGroup('Objetivos', groups.objectives)}
            {groups && renderGroup('Metas da semana', groups.weeklyGoals)}
          </div>
          <p aria-live="polite" className={cn('px-2 text-sm text-muted-foreground', options.length > 0 && 'sr-only')}>
            {status}
          </p>
        </DialogContent>
      </Dialog>
    </>
  )
}
