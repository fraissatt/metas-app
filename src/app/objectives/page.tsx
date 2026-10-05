import type { Metadata } from 'next'
import Link from 'next/link'
import { deleteObjective, listObjectivesWithStats } from '@/lib/actions/objectives'
import { calendarWeeks, overview, streak, timeline } from '@/lib/objective-dashboard'
import { CompletedObjectiveCard } from '@/components/completed-objective-card'
import { ObjectiveDashboardCard } from '@/components/objective-dashboard-card'
import { ObjectivesOverview } from '@/components/objectives-overview'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = { title: 'Objetivos' }

export default async function ObjectivesPage() {
  const { active, completed } = await listObjectivesWithStats()
  const now = new Date()
  const totals = overview(active, now)
  const hasAny = active.length + completed.length > 0

  return (
    <main className="mx-auto max-w-5xl p-4 md:p-8">
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
        <>
          <div className="mb-6">
            <ObjectivesOverview {...totals} />
          </div>

          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum objetivo em andamento. Que tal começar o próximo?
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {active.map((objective) => (
                <ObjectiveDashboardCard
                  key={objective.id}
                  id={objective.id}
                  title={objective.title}
                  startDate={objective.startDate}
                  weeks={calendarWeeks(objective.stats.recentWeeks, now)}
                  streak={streak(objective.stats.recentWeeks, now)}
                  timeline={timeline(objective.startDate, objective.targetDate, now)}
                  onDelete={deleteObjective.bind(null, objective.id)}
                />
              ))}
            </div>
          )}

          {/* Kept below the active ones rather than mixed in: with ten achievements
              the two objectives still in play would otherwise disappear among them. */}
          {completed.length > 0 && (
            <>
              <h2 className="mt-10 mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Concluídos
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
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
            </>
          )}
        </>
      )}

      <p className="mt-10 text-center text-xs">
        <Link href="/funil" className="text-muted-foreground underline-offset-4 hover:underline">
          Ver métricas do quiz
        </Link>
      </p>
    </main>
  )
}
