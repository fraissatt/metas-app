import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { prisma } from '@/lib/db'

afterEach(async () => {
  cleanup()
  await prisma.dailyTask.deleteMany()
  await prisma.weeklyGoal.deleteMany()
  await prisma.objective.deleteMany()
})
