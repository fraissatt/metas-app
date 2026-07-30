import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { prisma } from '@/lib/db'

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

afterEach(async () => {
  cleanup()
  await prisma.dailyTask.deleteMany()
  await prisma.weeklyGoal.deleteMany()
  await prisma.objective.deleteMany()
})
