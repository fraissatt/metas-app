import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { prisma } from '@/lib/db'
import { getWeekBounds } from '@/lib/dates'
import { actAs, TEST_USER_ID } from '@/test/session-mock'
import Home, { generateMetadata } from '@/app/page'

describe('root page', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the presentation page when there is no session', async () => {
    actAs(null)
    render(await Home())
    expect(screen.getByRole('heading', { level: 1, name: 'Metas' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Entrar como visitante' }).length).toBeGreaterThan(0)
  })

  it('keeps showing Hoje to a signed-in user (no objective yet sends them to the quiz)', async () => {
    await expect(Home()).rejects.toMatchObject({ digest: expect.stringContaining('/quiz') })
  })

  it('titles the page for the presentation or for Hoje', async () => {
    actAs(null)
    expect(await generateMetadata()).toMatchObject({ title: { absolute: 'Metas · Do objetivo à tarefa do dia' } })
    actAs({ id: 'u', name: 'Ana', email: 'a@b.com', isAnonymous: false })
    expect(await generateMetadata()).toMatchObject({ title: { absolute: 'Hoje · Metas' } })
  })

  it('shows the small steps section on the empty week screen', async () => {
    await prisma.objective.create({ data: { userId: TEST_USER_ID, title: 'Obj', startDate: new Date() } })
    render(await Home())
    expect(screen.getByRole('heading', { name: 'Seus pequenos passos' })).toBeInTheDocument()
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })

  it('shows the small steps section under a planned week', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    const objective = await prisma.objective.create({
      data: { userId: TEST_USER_ID, title: 'Obj', startDate: new Date() },
    })
    await prisma.weeklyGoal.create({ data: { title: 'Meta', objectiveId: objective.id, ...getWeekBounds(new Date()) } })
    render(await Home())
    expect(screen.getByRole('heading', { name: 'Seus pequenos passos' })).toBeInTheDocument()
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('heading', { name: 'Seus pequenos passos' }))
  })
})
