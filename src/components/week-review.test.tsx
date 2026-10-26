import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WeekReview } from '@/components/week-review'
import type { WeekReviewData } from '@/lib/week-review'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

function review(overrides: Partial<WeekReviewData> = {}): WeekReviewData {
  return {
    weekKey: '2026-10-19',
    rangeLabel: '19 a 25 de out.',
    repeatInto: 'current',
    reviewedOn: null,
    dots: ['19', '20', '21', '22', '23', '24', '25'].map((day, i) => ({
      key: `2026-10-${day}`,
      tone: i < 4 ? 'done' : 'empty',
      isCurrentDay: false,
    })),
    daysDone: 4,
    tasksCompleted: 18,
    tasksTotal: 24,
    previousDelta: 5,
    compound: { before: 1.32, after: 1.37 },
    projection: { daysPerWeek: 4, assumed: false, from: 1.37, to: 2.31 },
    goals: [
      { id: 'a', title: 'Correr 3x', objectiveTitle: 'Saúde', completed: 3, total: 3, fulfilled: true, repeat: 'choose' },
      { id: 'b', title: 'Ler 20 páginas', objectiveTitle: 'Estudo', completed: 2, total: 5, fulfilled: false, repeat: 'choose' },
      { id: 'c', title: 'Alongar', objectiveTitle: 'Saúde', completed: 1, total: 2, fulfilled: false, repeat: 'recurring' },
    ],
    ...overrides,
  }
}

describe('WeekReview', () => {
  it('shows the week as numbers: days, tasks, comparison, compound effect and projection', () => {
    render(<WeekReview review={review()} onFinish={vi.fn()} />)

    expect(screen.getByRole('heading', { level: 1, name: '19 a 25 de out.' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '4 de 7 dias feitos' })).toBeInTheDocument()
    expect(screen.getByText('de 24 tarefas cumpridas')).toBeInTheDocument()
    expect(screen.getByText('5 a mais que na semana anterior')).toBeInTheDocument()
    expect(screen.getByText('+4% no seu efeito composto')).toBeInTheDocument()
    expect(screen.getByText(/De 1,3× para 1,4×\./)).toBeInTheDocument()
    expect(screen.getByText(/Mantendo 4 dias feitos por semana, em 3 meses/)).toBeInTheDocument()
    expect(screen.getByText('1,4× → 2,3×')).toBeInTheDocument()
  })

  it('phrases a smaller week neutrally and an empty one as an assumed pace', () => {
    render(
      <WeekReview
        review={review({
          daysDone: 0,
          previousDelta: -2,
          projection: { daysPerWeek: 3, assumed: true, from: 1.37, to: 2.02 },
        })}
        onFinish={vi.fn()}
      />,
    )

    expect(screen.getByText('2 a menos que na semana anterior')).toBeInTheDocument()
    expect(screen.getByText('Seu efeito composto segue em 1,4×')).toBeInTheDocument()
    expect(screen.getByText(/Com 3 dias feitos por semana/)).toBeInTheDocument()
  })

  it('lists each goal with its progress and what happens next', () => {
    render(<WeekReview review={review()} onFinish={vi.fn()} />)

    expect(screen.getByText('✓ cumprida')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Ler 20 páginas: 2 de 5 tarefas' })).toHaveAttribute(
      'aria-valuenow',
      '2',
    )
    expect(screen.getByText('Volta sozinha')).toBeInTheDocument()
    expect(screen.getByText('Metas que se repetem sozinhas não precisam ser marcadas.')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Repetir Alongar' })).toBeNull()
  })

  it('repeats the ticked goals, then goes back to Hoje', async () => {
    const onFinish = vi.fn().mockResolvedValue(undefined)
    render(<WeekReview review={review()} onFinish={onFinish} />)

    expect(screen.getByRole('button', { name: /Repetir 2 metas nesta semana/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Repetir Ler 20 páginas' }))
    await userEvent.click(screen.getByRole('button', { name: /Repetir 1 meta nesta semana/ }))

    expect(onFinish).toHaveBeenCalledWith('2026-10-19', ['a'])
    expect(push).toHaveBeenCalledWith('/')
  })

  it('offers to just close the review when nothing is ticked, and names next week at the weekend', async () => {
    const onFinish = vi.fn().mockResolvedValue(undefined)
    render(<WeekReview review={review({ repeatInto: 'next' })} onFinish={onFinish} />)

    const goals = screen.getByRole('region', { name: 'Metas da semana' })
    expect(within(goals).getByRole('button', { name: /Repetir 2 metas na próxima semana/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Repetir Correr 3x' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Repetir Ler 20 páginas' }))
    await userEvent.click(screen.getByRole('button', { name: /Concluir revisão/ }))

    expect(onFinish).toHaveBeenCalledWith('2026-10-19', [])
  })

  it('says when the week was already reviewed', () => {
    render(<WeekReview review={review({ reviewedOn: '26/10' })} onFinish={vi.fn()} />)
    expect(screen.getByText('Revisada em 26/10')).toBeInTheDocument()
  })
})
