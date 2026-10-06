import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import type { CurrentUser } from '@/lib/session'

export const TEST_USER_ID = 'test-user'

let current: CurrentUser | null = null

export function actAs(user: CurrentUser | null): void {
  current = user
}

export async function createTestUser(id: string, overrides: Partial<CurrentUser> = {}): Promise<CurrentUser> {
  const user: CurrentUser = { id, name: id, email: `${id}@example.com`, isAnonymous: false, ...overrides }
  await prisma.user.create({ data: user })
  return user
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  return current
}

export async function requireUser(): Promise<CurrentUser> {
  if (!current) redirect('/entrar')
  return current
}
