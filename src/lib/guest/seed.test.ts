import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { seedDemoData } from '@/lib/guest/seed'
import { createTestUser } from '@/test/session-mock'

describe('seedDemoData', () => {
  it('writes the demo objectives, goals and tasks owned by the user', async () => {
    await createTestUser('guest-1', { isAnonymous: true })
    await seedDemoData('guest-1', new Date(2026, 9, 7, 15))
    expect(await prisma.objective.count({ where: { userId: 'guest-1' } })).toBe(3)
    expect(await prisma.weeklyGoal.count({ where: { objective: { userId: 'guest-1' } } })).toBeGreaterThanOrEqual(16)
    expect(await prisma.dailyTask.count({ where: { weeklyGoal: { objective: { userId: 'guest-1' } }, completed: true } })).toBeGreaterThan(0)
  })
})
