import Link from 'next/link'
import { getWeekProgress, listWeeklyGoalsForCurrentWeek } from '@/lib/actions/weeklyGoals'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

export default async function WeekPage() {
  const goals = await listWeeklyGoalsForCurrentWeek()
  const progress = await Promise.all(goals.map((g) => getWeekProgress(g.id)))

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">Esta semana</h1>
      {goals.length === 0 ? (
        <p className="text-muted-foreground">Nenhuma meta semanal para esta semana.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {goals.map((goal, i) => (
            <Card key={goal.id}>
              <CardHeader>
                <CardTitle>
                  <Link href={`/objectives/${goal.objective.id}/weeks/${goal.id}`}>{goal.title}</Link>
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {goal.objective.title}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Progress value={progress[i].percent} />
                <span className="text-sm text-muted-foreground">
                  {progress[i].completed}/{progress[i].total} tarefas ({progress[i].percent}%)
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  )
}
