import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import WeekReviewPage from '@/app/revisao/page'

describe('/revisao', () => {
  it('says there is nothing to review yet for a new account', async () => {
    render(await WeekReviewPage())
    expect(screen.getByRole('heading', { name: 'Ainda não há uma semana para revisar.' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar para Hoje' })).toHaveAttribute('href', '/')
  })
})
