import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { moveGuestDataOnSignUp } from '@/lib/guest/link'
import { createTestUser } from '@/test/session-mock'

async function guestWithData(id: string, objectives = 1) {
  const guest = await createTestUser(id, { isAnonymous: true })
  for (let i = 0; i < objectives; i++) {
    const objective = await prisma.objective.create({
      data: { userId: id, title: `Obj ${i}`, startDate: new Date('2026-10-05T03:00:00Z') },
    })
    const goal = await prisma.weeklyGoal.create({
      data: {
        title: `Meta ${i}`,
        objectiveId: objective.id,
        weekStart: new Date('2026-10-05T03:00:00Z'),
        weekEnd: new Date('2026-10-12T02:59:59.999Z'),
      },
    })
    await prisma.dailyTask.create({ data: { title: `Tarefa ${i}`, weeklyGoalId: goal.id, date: new Date('2026-10-06T03:00:00Z') } })
  }
  return guest
}

const args = (guestId: string, newUser: { id: string; isAnonymous?: boolean }, path: string) => ({
  anonymousUser: { user: { id: guestId } },
  newUser: { user: newUser },
  ctx: { path },
})

describe('moveGuestDataOnSignUp', () => {
  it('moves every objective, with its goals and tasks, to the new account on sign-up', async () => {
    await guestWithData('guest-1', 2)
    await createTestUser('new-1')

    await moveGuestDataOnSignUp(args('guest-1', { id: 'new-1' }, '/sign-up/email'))

    expect(await prisma.objective.count({ where: { userId: 'guest-1' } })).toBe(0)
    expect(await prisma.objective.count({ where: { userId: 'new-1' } })).toBe(2)
    expect(await prisma.weeklyGoal.count({ where: { objective: { userId: 'new-1' } } })).toBe(2)
    expect(await prisma.dailyTask.count({ where: { weeklyGoal: { objective: { userId: 'new-1' } } } })).toBe(2)
  })

  it('keeps the weeks the guest reviewed and their daily reminder', async () => {
    await guestWithData('guest-r')
    await prisma.weekReview.create({ data: { userId: 'guest-r', weekStart: new Date('2026-10-05T03:00:00Z') } })
    await prisma.pushSubscription.create({
      data: { userId: 'guest-r', endpoint: 'https://push.example.com/g', p256dh: 'k', auth: 'a' },
    })
    await createTestUser('new-r')

    await moveGuestDataOnSignUp(args('guest-r', { id: 'new-r' }, '/sign-up/email'))

    expect(await prisma.weekReview.count({ where: { userId: 'new-r' } })).toBe(1)
    expect(await prisma.pushSubscription.count({ where: { userId: 'new-r' } })).toBe(1)
  })

  it('moves nothing when the guest signs in to an existing account', async () => {
    await guestWithData('guest-2')
    await createTestUser('existing-2')

    await moveGuestDataOnSignUp(args('guest-2', { id: 'existing-2' }, '/sign-in/email'))

    expect(await prisma.objective.count({ where: { userId: 'guest-2' } })).toBe(1)
    expect(await prisma.objective.count({ where: { userId: 'existing-2' } })).toBe(0)
  })

  it('moves nothing when the new user is itself a guest', async () => {
    await guestWithData('guest-3')
    await createTestUser('guest-3b', { isAnonymous: true })

    await moveGuestDataOnSignUp(args('guest-3', { id: 'guest-3b', isAnonymous: true }, '/sign-up/email'))

    expect(await prisma.objective.count({ where: { userId: 'guest-3' } })).toBe(1)
  })

  it("leaves other users' objectives alone", async () => {
    await guestWithData('guest-4')
    await createTestUser('other-4')
    await prisma.objective.create({ data: { userId: 'other-4', title: 'Alheio', startDate: new Date('2026-10-05T03:00:00Z') } })
    await createTestUser('new-4')

    await moveGuestDataOnSignUp(args('guest-4', { id: 'new-4' }, '/sign-up/email'))

    expect(await prisma.objective.count({ where: { userId: 'other-4' } })).toBe(1)
    expect(await prisma.objective.count({ where: { userId: 'new-4' } })).toBe(1)
  })
})
