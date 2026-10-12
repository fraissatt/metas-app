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

  it('offers the three ways in', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Entrar como visitante' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Criar conta' })).toHaveAttribute('href', '/cadastro')
    expect(screen.getByRole('link', { name: 'Já tenho conta' })).toHaveAttribute('href', '/entrar')
    expect(
      screen.getByText('Conta de demonstração com dados prontos. Os dados somem após 24 h sem uso.'),
    ).toBeInTheDocument()
  })

  it('lists the six cards in order, none of them interactive', () => {
    setup()
    const list = screen.getByRole('list', { name: 'O que o Metas oferece' })
    const titles = within(list)
      .getAllByRole('heading')
      .map((heading) => heading.textContent)
    expect(titles).toEqual([
      'Objetivos',
      'Metas semanais',
      'Tarefas diárias',
      'Modo visitante',
      'Quiz de plano',
      'App instalável',
    ])
    expect(within(list).queryAllByRole('link')).toHaveLength(0)
    expect(within(list).queryAllByRole('button')).toHaveLength(0)
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
