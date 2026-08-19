import Link from 'next/link'
import { MissingGoalsCard } from '@/components/missing-goals-card'
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
      <p className="text-center text-sm text-muted-foreground">Sua semana ainda está vazia.</p>

      <MissingGoalsCard preview={preview} onRepeat={onRepeat} />

      {/* A link rather than an inline form: creating a weekly goal requires
          picking an objective, which happens on /objectives/[id]. */}
      <Link
        href="/objectives"
        className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
      >
        + Nova meta semanal
      </Link>
    </section>
  )
}
