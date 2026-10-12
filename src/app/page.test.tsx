import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { actAs } from '@/test/session-mock'
import Home, { generateMetadata } from '@/app/page'

describe('root page', () => {
  it('shows the presentation page when there is no session', async () => {
    actAs(null)
    render(await Home())
    expect(screen.getByRole('heading', { level: 1, name: 'Metas' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entrar como visitante' })).toBeInTheDocument()
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
})
