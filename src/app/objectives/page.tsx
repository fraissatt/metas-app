import Link from 'next/link'
import { listObjectives } from '@/lib/actions/objectives'
import { deleteObjective } from '@/lib/actions/objectives'
import { DeleteButton } from '@/components/delete-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function ObjectivesPage() {
  const objectives = await listObjectives()

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Objetivos</h1>
        <Button nativeButton={false} render={<Link href="/objectives/new" />}>
          Novo objetivo
        </Button>
      </div>
      <div className="flex flex-col gap-4">
        {objectives.map((objective) => (
          <Card key={objective.id}>
            <CardHeader>
              <CardTitle>
                <Link href={`/objectives/${objective.id}`} className="transition-colors hover:text-primary hover:underline">
                  {objective.title}
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{objective.status}</span>
              <div className="flex gap-2">
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
        ))}
      </div>
    </main>
  )
}
