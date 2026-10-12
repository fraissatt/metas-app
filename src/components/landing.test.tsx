import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { Landing } from '@/components/landing'

const setup = () => render(<Landing onEnterAsGuest={vi.fn()} />)

describe('Landing', () => {
  it('shows the title, the subtitle and one h1', () => {
    setup()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1, name: 'Metas' })).toBeInTheDocument()
    expect(screen.getByText('Do objetivo à tarefa do dia, sem se perder no meio do caminho.')).toBeInTheDocument()
  })

  it('offers the three ways in at the top and again at the end', () => {
    setup()
    expect(screen.getAllByRole('button', { name: 'Entrar como visitante' })).toHaveLength(2)
    for (const link of screen.getAllByRole('link', { name: 'Criar conta' })) {
      expect(link).toHaveAttribute('href', '/cadastro')
    }
    expect(screen.getAllByRole('link', { name: 'Criar conta' })).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'Já tenho conta' })).toHaveAttribute('href', '/entrar')
    expect(
      screen.getByText('Conta de demonstração com dados prontos. Os dados somem após 24 h sem uso.'),
    ).toBeInTheDocument()
  })

  it('has no screenshots: the live demo is the showcase', () => {
    setup()
    expect(screen.queryAllByRole('img')).toHaveLength(0)
    expect(screen.getByRole('region', { name: 'Demonstração interativa' })).toBeInTheDocument()
  })

  it('explains how it works in three numbered steps, in order', () => {
    setup()
    expect(screen.getByRole('heading', { level: 2, name: 'Como funciona' })).toBeInTheDocument()
    const steps = screen.getByRole('list', { name: 'Como funciona' })
    expect(steps.tagName).toBe('OL')
    const titles = within(steps)
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent)
    expect(titles).toEqual(['Objetivo', 'Meta da semana', 'Tarefa do dia'])
  })

  it('lists the three extra features as cards, none of them interactive', () => {
    setup()
    expect(screen.getByRole('heading', { level: 2, name: 'E também' })).toBeInTheDocument()
    const list = screen.getByRole('list', { name: 'E também' })
    const titles = within(list)
      .getAllByRole('heading')
      .map((heading) => heading.textContent)
    expect(titles).toEqual(['Modo visitante', 'Quiz de plano', 'App instalável'])
    expect(within(list).queryAllByRole('link')).toHaveLength(0)
    expect(within(list).queryAllByRole('button')).toHaveLength(0)
  })

  it('orders the sections: how it works, then the extras, then the closing call', () => {
    setup()
    const headings = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
    expect(headings).toEqual(['Como funciona', 'E também', 'Pronto para começar?'])
  })

  it('has a footer with the source link and the rights notice', () => {
    setup()
    const footer = screen.getByRole('contentinfo')
    expect(within(footer).getByRole('link', { name: 'Código no GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/fraissatt/metas-app',
    )
    expect(within(footer).getByText('Todos os direitos reservados')).toBeInTheDocument()
  })
})
