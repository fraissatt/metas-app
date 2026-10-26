'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Repeat, RotateCcw } from 'lucide-react'
import { Dot } from '@/components/dot'
import { PanelList } from '@/components/panel-list'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { formatFactor } from '@/lib/day-dots'
import { cn } from '@/lib/utils'
import type { GoalRepeat, ReviewGoalRow, WeekReviewData } from '@/lib/week-review'

const WEEKDAY_INITIALS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']

const HEADING = 'text-sm font-semibold tracking-wide text-muted-foreground uppercase'

const REPEAT_NOTE: Record<Exclude<GoalRepeat, 'choose'>, string> = {
  recurring: 'Volta sozinha',
  planned: 'Já planejada',
  closed: 'Objetivo concluído',
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

function comparison(delta: number): string {
  if (delta === 0) return 'O mesmo que na semana anterior'
  return delta > 0 ? `${delta} a mais que na semana anterior` : `${-delta} a menos que na semana anterior`
}

/** What the week added, as a whole percentage: a factor like 1,4× hides one day's 1%. */
function growthPercent({ before, after }: WeekReviewData['compound']): number {
  return Math.round((after / before - 1) * 100)
}

function actionLabel(count: number, repeatInto: WeekReviewData['repeatInto']): string {
  if (count === 0) return 'Concluir revisão'
  const where = repeatInto === 'next' ? 'na próxima semana' : 'nesta semana'
  return `Repetir ${plural(count, 'meta', 'metas')} ${where}`
}

function Row({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('card-roomy px-4 py-3', className)}>{children}</div>
}

function WeekDots({ review }: { review: WeekReviewData }) {
  return (
    <div className="flex gap-1.5" role="img" aria-label={`${review.daysDone} de 7 dias feitos`}>
      {review.dots.map((dot, i) => (
        <span key={dot.key} className="flex flex-col items-center gap-1">
          <Dot dot={dot} size="md" />
          <span aria-hidden="true" className="text-[10px] font-medium text-muted-foreground">
            {WEEKDAY_INITIALS[i]}
          </span>
        </span>
      ))}
    </div>
  )
}

function GoalRow({
  goal,
  checked,
  onCheckedChange,
}: {
  goal: ReviewGoalRow
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  const percent = goal.total === 0 ? 0 : Math.round((goal.completed / goal.total) * 100)

  return (
    <Row className="flex items-center gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold break-words">{goal.title}</p>
        <p className="text-xs break-words text-muted-foreground">{goal.objectiveTitle}</p>
        <div className="mt-2 flex items-center gap-3">
          <div
            role="progressbar"
            aria-label={`${goal.title}: ${goal.completed} de ${goal.total} tarefas`}
            aria-valuemin={0}
            aria-valuemax={goal.total}
            aria-valuenow={goal.completed}
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
          </div>
          {goal.fulfilled ? (
            <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-accent-foreground">
              ✓ cumprida
            </span>
          ) : (
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {goal.completed}/{goal.total}
            </span>
          )}
        </div>
      </div>

      <div className="shrink-0 text-right text-xs text-muted-foreground">
        {goal.repeat === 'choose' ? (
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <Checkbox
              checked={checked}
              onCheckedChange={(value) => onCheckedChange(value === true)}
            />
            Repetir <span className="sr-only">{goal.title}</span>
          </label>
        ) : (
          <span className="inline-flex items-center gap-1">
            {goal.repeat === 'recurring' && <Repeat aria-hidden="true" className="size-3.5" />}
            {REPEAT_NOTE[goal.repeat]}
          </span>
        )}
      </div>
    </Row>
  )
}

/**
 * The review of one week: what happened (numbers, not praise), what it added
 * to the compound effect, where the same pace leads, and which goals continue.
 */
export function WeekReview({
  review,
  onFinish,
}: {
  review: WeekReviewData
  onFinish: (weekKey: string, goalIds: string[]) => Promise<void>
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  // Ticked by default: the old button repeated everything, so leaving a goal
  // behind is the deliberate act.
  const [selected, setSelected] = useState(
    () => new Set(review.goals.filter((goal) => goal.repeat === 'choose').map((goal) => goal.id)),
  )
  const hasRecurring = review.goals.some((goal) => goal.repeat === 'recurring')
  const { compound, projection } = review

  function toggle(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function finish() {
    startTransition(async () => {
      await onFinish(review.weekKey, [...selected])
      router.push('/')
    })
  }

  return (
    <>
      <header className="mb-8">
        <p className={HEADING}>Revisão da semana</p>
        <h1 className="mt-1 text-2xl font-semibold">{review.rangeLabel}</h1>
        {review.reviewedOn && (
          <p className="mt-1 text-sm text-muted-foreground">Revisada em {review.reviewedOn}</p>
        )}
      </header>

      <section aria-labelledby="resultado" className="flex flex-col gap-4">
        <h2 id="resultado" className={HEADING}>
          Resultado
        </h2>
        <PanelList>
          <Row className="flex flex-wrap items-center justify-between gap-4">
            <p className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums">{review.daysDone}</span>
              <span className="text-sm text-muted-foreground">de 7 dias feitos</span>
            </p>
            <WeekDots review={review} />
          </Row>

          <Row>
            <p className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums">{review.tasksCompleted}</span>
              <span className="text-sm text-muted-foreground">
                de {plural(review.tasksTotal, 'tarefa cumprida', 'tarefas cumpridas')}
              </span>
            </p>
            {review.previousDelta !== null && (
              <p className="mt-1 text-sm text-muted-foreground">{comparison(review.previousDelta)}</p>
            )}
          </Row>

          <Row>
            <p className="text-sm font-semibold text-primary">
              {review.daysDone > 0
                ? `+${growthPercent(compound)}% no seu efeito composto`
                : `Seu efeito composto segue em ${formatFactor(compound.after)}`}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {review.daysDone > 0 && `De ${formatFactor(compound.before)} para ${formatFactor(compound.after)}. `}
              Cada dia feito soma 1% ao anterior.
            </p>
          </Row>

          <Row>
            <p className="text-sm">
              {projection.assumed
                ? `Com ${plural(projection.daysPerWeek, 'dia feito', 'dias feitos')} por semana, em 3 meses: `
                : `Mantendo ${plural(projection.daysPerWeek, 'dia feito', 'dias feitos')} por semana, em 3 meses: `}
              <span className="font-semibold tabular-nums">
                {formatFactor(projection.from)} → {formatFactor(projection.to)}
              </span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {projection.assumed ? 'Uma projeção para um ritmo leve.' : 'Projeção a partir desta semana.'}
            </p>
          </Row>
        </PanelList>
      </section>

      <section aria-labelledby="metas-da-semana" className="mt-10 flex flex-col gap-4">
        <h2 id="metas-da-semana" className={HEADING}>
          Metas da semana
        </h2>
        <PanelList>
          {review.goals.map((goal) => (
            <GoalRow
              key={goal.id}
              goal={goal}
              checked={selected.has(goal.id)}
              onCheckedChange={(checked) => toggle(goal.id, checked)}
            />
          ))}
        </PanelList>

        <div className="flex flex-col gap-2 sm:items-start">
          <Button type="button" disabled={isPending} onClick={finish}>
            {selected.size > 0 ? <RotateCcw className="size-4" /> : <Check className="size-4" />}
            {isPending ? 'Salvando…' : actionLabel(selected.size, review.repeatInto)}
          </Button>
          {hasRecurring && (
            <p className="text-xs text-muted-foreground">Metas que se repetem sozinhas não precisam ser marcadas.</p>
          )}
        </div>
      </section>
    </>
  )
}
