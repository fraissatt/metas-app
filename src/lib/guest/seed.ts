import { prisma } from '@/lib/db'
import { buildDemoData } from '@/lib/guest/demo-data'

export async function seedDemoData(userId: string, now: Date = new Date()): Promise<void> {
  const objectives = buildDemoData(now)
  await prisma.$transaction(async (tx) => {
    for (const { goals, ...objective } of objectives) {
      const created = await tx.objective.create({ data: { ...objective, userId } })
      for (const { tasks, ...goal } of goals) {
        const createdGoal = await tx.weeklyGoal.create({ data: { ...goal, objectiveId: created.id } })
        await tx.dailyTask.createMany({ data: tasks.map((task) => ({ ...task, weeklyGoalId: createdGoal.id })) })
      }
    }
  })
}
