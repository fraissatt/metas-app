'use server'

import { isSameDay, startOfDay } from 'date-fns'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { getWeekBounds } from '@/lib/dates'
import { buildPlan } from '@/lib/quiz/build-plan'
import { validateAnswers, type QuizAnswers } from '@/lib/quiz/definition'
import { isValidSessionId } from '@/lib/quiz/session'

const FAILURE = 'Não foi possível criar o plano'

export async function createPlanFromQuiz(input: { sessionId: string; answers: unknown }): Promise<void> {
  let answers: QuizAnswers
  try {
    answers = validateAnswers(input?.answers)
  } catch {
    throw new Error(FAILURE)
  }

  const now = new Date()
  const plan = buildPlan(answers, now)
  // Tracking must never block the user: an invalid sessionId only skips the event.
  const sessionId = input.sessionId

  const user = await requireUser()

  const objectiveId = await prisma.$transaction(async (tx) => {
    const objective = await tx.objective.create({
      data: {
        title: plan.objective.title,
        userId: user.id,
        startDate: startOfDay(now),
        targetDate: plan.objective.targetDate,
      },
    })

    for (const week of plan.weeks) {
      const goal = await tx.weeklyGoal.create({
        data: {
          title: plan.weeklyGoal.title,
          objectiveId: objective.id,
          weekStart: week.weekStart,
          weekEnd: week.weekEnd,
          recurring: week.recurring,
        },
      })
      await tx.dailyTask.createMany({
        data: week.tasks.map((task) => ({ title: task.title, weeklyGoalId: goal.id, date: task.date })),
      })
    }

    if (isValidSessionId(sessionId)) {
      await tx.funnelEvent.create({ data: { sessionId, type: 'plan_created' } })
    }

    return objective.id
  })

  revalidatePath('/')
  revalidatePath('/objectives')
  // redirect throws in real Next, so it must come last.
  // A plan that only starts next week would land on an empty Hoje, so send
  // the user to the objective, where the first week is visible.
  const startsThisWeek = isSameDay(plan.weeks[0].weekStart, getWeekBounds(now).weekStart)
  redirect(startsThisWeek ? '/' : `/objectives/${objectiveId}`)
}
