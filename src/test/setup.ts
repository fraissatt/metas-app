import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { prisma } from '@/lib/db'
import { actAs, createTestUser, TEST_USER_ID } from '@/test/session-mock'

// Server Actions call `revalidatePath`, which relies on a Next.js
// request-scoped store (AsyncLocalStorage) that only exists when the app is
// actually running inside Next's server runtime. Unit tests invoke Server
// Actions directly, outside that runtime, so `revalidatePath` would throw
// an "Invariant: static generation store missing" error. Mock it here so
// the actions can be exercised in isolation.
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock('@/lib/session', () => import('@/test/session-mock'))

beforeEach(async () => {
  actAs(await createTestUser(TEST_USER_ID))
})

afterEach(async () => {
  cleanup()
  await prisma.funnelEvent.deleteMany()
  await prisma.dailyTask.deleteMany()
  await prisma.weeklyGoal.deleteMany()
  await prisma.objective.deleteMany()
  await prisma.session.deleteMany()
  await prisma.account.deleteMany()
  await prisma.verification.deleteMany()
  await prisma.rateLimit.deleteMany()
  await prisma.user.deleteMany()
  actAs(null)
})
