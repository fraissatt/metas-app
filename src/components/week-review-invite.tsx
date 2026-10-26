import Link from 'next/link'
import { Dot, daysDoneLabel } from '@/components/dot'
import { buttonVariants } from '@/components/ui/button'
import type { WeekReviewInvite as Invite } from '@/lib/actions/weekReview'

/** Hoje's one-line invitation to close the week, shown only while the review is due. */
export function WeekReviewInvite({ invite }: { invite: Invite }) {
  const tasks = invite.tasksCompleted === 1 ? '1 tarefa' : `${invite.tasksCompleted} tarefas`

  return (
    <section
      aria-label="Revisão da semana"
      className="card-roomy mb-6 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-border bg-card px-4 py-3"
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Revisão da semana · {invite.rangeLabel}
        </p>
        <p className="mt-1 text-sm">
          {daysDoneLabel(invite.daysDone)} · {tasks}
        </p>
      </div>
      <div className="flex gap-1" aria-hidden="true">
        {invite.dots.map((dot) => (
          <Dot key={dot.key} dot={dot} size="sm" />
        ))}
      </div>
      <Link href="/revisao" className={buttonVariants({ size: 'sm' })}>
        Revisar
      </Link>
    </section>
  )
}
