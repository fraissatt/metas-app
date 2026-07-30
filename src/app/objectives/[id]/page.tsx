import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getObjective } from '@/lib/actions/objectives'
import { deleteWeeklyGoal, getWeekProgress, listWeeklyGoalsByObjective } from '@/lib/actions/weeklyGoals'
import { DeleteButton } from '@/components/delete-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

export default async function ObjectiveDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const objective = await getObjective(id)
  if (!objective) notFound()

  const weeklyGoals = await listWeeklyGoalsByObjective(id)
  const progressByGoal = await Promise.all(weeklyGoals.map((g) => getWeekProgress(g.id)))

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{objective.title}</h1>
        <Button render={<Link href={`/objectives/${id}/weeks/new`} />}>Nova meta semanal</Button>
      </div>
      <div className="flex flex-col gap-4">
        {weeklyGoals.map((goal, i) => (
          <Card key={goal.id}>
            <CardHeader>
              <CardTitle>
                <Link href={`/objectives/${id}/weeks/${goal.id}`}>{goal.title}</Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Progress value={progressByGoal[i].percent} />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {progressByGoal[i].completed}/{progressByGoal[i].total} tarefas
                </span>
                <div className="flex gap-2">
                  <Button variant="secondary" render={<Link href={`/objectives/${id}/weeks/${goal.id}/edit`} />}>
                    Editar
                  </Button>
                  <DeleteButton action={deleteWeeklyGoal.bind(null, goal.id)} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  )
}
