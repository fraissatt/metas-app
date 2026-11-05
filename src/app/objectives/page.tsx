import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { deleteObjective, listObjectivesWithStats } from '@/lib/actions/objectives'
import { calendarWeeks, overview, streak, timeline } from '@/lib/objective-dashboard'
import { CompletedObjectiveCard } from '@/components/completed-objective-card'
import { ObjectiveDashboardCard } from '@/components/objective-dashboard-card'
import { ObjectivesOverview } from '@/components/objectives-overview'
import { PanelList } from '@/components/panel-list'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = { title: 'Objetivos' }

const sectionTitle = 'mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase'

export default async function ObjectivesPage() {
  const { active, completed } = await listObjectivesWithStats()
  const now = new Date()
  const totals = overview(active, now)
  const hasAny = active.length + completed.length > 0

  return (
    <main className="mx-auto max-w-2xl p-4 md:p-8 lg:max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Objetivos</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" nativeButton={false} render={<Link href="/quiz" />}>
            Montar plano com o quiz
          </Button>
          <Button nativeButton={false} render={<Link href="/objectives/new" />}>
            Novo objetivo
          </Button>
        </div>
      </div>

      {!hasAny ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-muted-foreground">Você ainda não tem objetivos.</p>
          <Button nativeButton={false} render={<Link href="/quiz" />}>
            Montar plano com o quiz
          </Button>
          <Button variant="secondary" nativeButton={false} render={<Link href="/objectives/new" />}>
            Criar meu primeiro objetivo
          </Button>
        </div>
      ) : (
        // Same split as Today: what is in play on the left, the summary and the
        // achievements beside it. On a phone the summary comes first.
        <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[3fr_2fr] lg:items-start">
          <section aria-labelledby="em-andamento" className="order-2 lg:order-none lg:row-span-2">
            <h2 id="em-andamento" className={sectionTitle}>
              Em andamento
            </h2>
            {active.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum objetivo em andamento. Que tal começar o próximo?
              </p>
            ) : (
              <PanelList>
                {active.map((objective) => (
                  <ObjectiveDashboardCard
                    key={objective.id}
                    id={objective.id}
                    title={objective.title}
                    weeks={calendarWeeks(objective.stats.recentWeeks, now)}
                    streak={streak(objective.stats.recentWeeks, now)}
                    timeline={timeline(objective.startDate, objective.targetDate, now)}
                    onDelete={deleteObjective.bind(null, objective.id)}
                  />
                ))}
              </PanelList>
            )}
          </section>

          <section aria-labelledby="resumo" className="order-1 lg:order-none">
            <h2 id="resumo" className="sr-only">
              Resumo
            </h2>
            <ObjectivesOverview {...totals} />
          </section>

          {/* Kept apart from the active ones, and folded: with ten achievements the
              objectives still in play would otherwise disappear among them. */}
          {completed.length > 0 && (
            <section aria-labelledby="concluidos" className="order-3 lg:order-none">
              <h2 id="concluidos" className={sectionTitle}>
                Concluídos
              </h2>
              <details className="group overflow-hidden rounded-lg border border-border bg-card">
                <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  {completed.length} {completed.length === 1 ? 'concluído' : 'concluídos'}
                  <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="divide-y divide-border border-t border-border">
                  {completed.map((objective) => (
                    <CompletedObjectiveCard
                      key={objective.id}
                      id={objective.id}
                      title={objective.title}
                      completedAt={objective.completedAt}
                      targetDate={objective.targetDate}
                      weeksFulfilled={objective.stats.weeksFulfilled}
                      tasksCompleted={objective.stats.tasksCompleted}
                      onDelete={deleteObjective.bind(null, objective.id)}
                    />
                  ))}
                </div>
              </details>
            </section>
          )}
        </div>
      )}

      <p className="mt-10 text-center text-xs">
        <Link href="/funil" className="text-muted-foreground underline-offset-4 hover:underline">
          Ver métricas do quiz
        </Link>
      </p>
    </main>
  )
}
