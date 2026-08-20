import Link from 'next/link'
import { MissingGoalsCard } from '@/components/missing-goals-card'
import { buttonVariants } from '@/components/ui/button'
import type { MissingGoalsPreview } from '@/lib/actions/weeklyGoals'

export function ReturnEmptyState({
  preview,
  onRepeat,
}: {
  preview: MissingGoalsPreview
  onRepeat: () => Promise<void>
}) {
  return (
    <section className="mx-auto flex max-w-sm flex-col gap-4 py-12">
      <h1 className="text-center text-2xl font-semibold text-muted-foreground">
        Sua semana ainda está vazia.
      </h1>

      <MissingGoalsCard preview={preview} onRepeat={onRepeat} />

      {/* A link rather than an inline form: creating a weekly goal requires
          picking an objective, which happens on /objectives/[id]. */}
      <Link href="/objectives" className={buttonVariants({ variant: 'outline' })}>
        + Nova meta semanal
      </Link>
    </section>
  )
}
