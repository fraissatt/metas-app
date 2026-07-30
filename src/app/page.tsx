import Link from 'next/link'
import { listDailyTasksByDate, toggleDailyTask } from '@/lib/actions/dailyTasks'
import { TaskToggle } from '@/components/task-toggle'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function Home() {
  const tasks = await listDailyTasksByDate(new Date())

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">Hoje</h1>
      {tasks.length === 0 ? (
        <p className="text-muted-foreground">Nenhuma tarefa para hoje.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {tasks.map((task) => (
            <Card key={task.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  <Link href={`/objectives/${task.weeklyGoal.objective.id}`}>
                    {task.weeklyGoal.objective.title}
                  </Link>
                  {' · '}
                  {task.weeklyGoal.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-3">
                <TaskToggle taskId={task.id} completed={task.completed} action={toggleDailyTask} />
                <span className={task.completed ? 'line-through text-muted-foreground' : ''}>
                  {task.title}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  )
}
