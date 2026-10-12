// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

const ORIGIN = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'
const PASSWORD = 'correct-horse-battery'

function post(path: string, body: unknown, cookie?: string) {
  return auth.handler(
    new Request(`${ORIGIN}/api/auth${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN, ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(body),
    }),
  )
}

const cookieOf = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')

async function signInAsGuest() {
  const response = await post('/sign-in/anonymous', {})
  expect(response.status).toBe(200)
  const { user } = (await response.json()) as { user: { id: string } }
  return { id: user.id, cookie: cookieOf(response) }
}

const objectiveFor = (userId: string, title: string) =>
  prisma.objective.create({ data: { userId, title, startDate: new Date('2026-10-05T03:00:00Z') } })

describe('guest becomes an account', () => {
  it('sign-up from a guest session keeps the guest objectives in the new account', async () => {
    const guest = await signInAsGuest()
    await objectiveFor(guest.id, 'Do visitante')

    const response = await post('/sign-up/email', { name: 'Ana', email: 'ana@example.com', password: PASSWORD }, guest.cookie)
    expect(response.status).toBe(200)
    const { user } = (await response.json()) as { user: { id: string } }

    const mine = await prisma.objective.findMany({ where: { userId: user.id } })
    expect(mine.map((o) => o.title)).toEqual(['Do visitante'])
    expect(await prisma.user.findUnique({ where: { id: guest.id } })).toBeNull()
  })

  it('a failed sign-up leaves the guest session and data intact', async () => {
    const guest = await signInAsGuest()
    await objectiveFor(guest.id, 'Do visitante')

    const response = await post('/sign-up/email', { name: 'Ana', email: 'ana@example.com', password: 'curta' }, guest.cookie)
    expect(response.status).toBeGreaterThanOrEqual(400)

    expect(await prisma.user.findUnique({ where: { id: guest.id } })).not.toBeNull()
    expect(await prisma.objective.count({ where: { userId: guest.id } })).toBe(1)
  })

  it("signing in to an existing account drops the guest data and keeps the account's own", async () => {
    const signUp = await post('/sign-up/email', { name: 'Bia', email: 'bia@example.com', password: PASSWORD })
    const { user: existing } = (await signUp.json()) as { user: { id: string } }
    await objectiveFor(existing.id, 'Da conta')

    const guest = await signInAsGuest()
    await objectiveFor(guest.id, 'Do visitante')

    const response = await post('/sign-in/email', { email: 'bia@example.com', password: PASSWORD }, guest.cookie)
    expect(response.status).toBe(200)

    const titles = (await prisma.objective.findMany({ where: { userId: existing.id } })).map((o) => o.title)
    expect(titles).toEqual(['Da conta'])
    expect(await prisma.user.findUnique({ where: { id: guest.id } })).toBeNull()
  })
})
