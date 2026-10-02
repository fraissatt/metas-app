import type { Metadata } from 'next'
import Link from 'next/link'
import { deleteObjective, listObjectivesWithStats, type ObjectiveWithStats } from '@/lib/actions/objectives'
import { describeSchedule } from '@/lib/objectives'
import { DeleteButton } from '@/components/delete-button'
import { ObjectiveStatsPanel } from '@/components/objective-stats'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/dates'

export const metadata: Metadata = { title: 'Objetivos' }

function ObjectiveRow({ objective }: { objective: ObjectiveWithStats }) {
  const schedule = objective.completedAt
    ? describeSchedule(objective.completedAt, objective.targetDate)
    : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Link
            href={`/objectives/${objective.id}`}
            className="break-words transition-colors hover:text-primary hover:underline"
          >
            {objective.title}
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ObjectiveStatsPanel stats={objective.stats} compact completed={!!objective.completedAt} />

        {objective.completedAt && (
          <p className="text-sm font-medium text-primary">
            ✓ Concluído em {formatDate(objective.completedAt)}
            {schedule ? ` · ${schedule}` : ''}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            nativeButton={false}
            render={<Link href={`/objectives/${objective.id}/edit`} />}
          >
            Editar
          </Button>
          <DeleteButton
            action={deleteObjective.bind(null, objective.id)}
            confirmDescription="Isso também excluirá todas as metas semanais e tarefas diárias relacionadas. Esta ação não pode ser desfeita."
          />
        </div>
      </CardContent>
    </Card>
  )
}

export default async function ObjectivesPage() {
  const { active, completed } = await listObjectivesWithStats()

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Objetivos</h1>
        <Button nativeButton={false} render={<Link href="/objectives/new" />}>
          Novo objetivo
        </Button>
      </div>

      {active.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {completed.length > 0
            ? 'Nenhum objetivo em andamento. Que tal começar o próximo?'
            : 'Você ainda não tem objetivos. Crie o primeiro para planejar a semana.'}
        </p>
      )}

      <div className="flex flex-col gap-4">
        {active.map((objective) => (
          <ObjectiveRow key={objective.id} objective={objective} />
        ))}
      </div>

      {/* Kept below the active ones rather than mixed in: with ten achievements
          the two objectives still in play would otherwise disappear among them. */}
      {completed.length > 0 && (
        <>
          <h2 className="mt-10 mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Concluídos
          </h2>
          <div className="flex flex-col gap-4">
            {completed.map((objective) => (
              <ObjectiveRow key={objective.id} objective={objective} />
            ))}
          </div>
        </>
      )}
    </main>
  )
}
