import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WeekReviewInvite } from '@/components/week-review-invite'

describe('WeekReviewInvite', () => {
  it('sums up the week and links to the review', () => {
    render(
      <WeekReviewInvite
        invite={{
          weekKey: '2026-10-19',
          rangeLabel: '19 a 25 de out.',
          dots: [{ key: '2026-10-19', tone: 'done', isCurrentDay: false }],
          daysDone: 1,
          tasksCompleted: 1,
        }}
      />,
    )

    const invite = screen.getByRole('region', { name: 'Revisão da semana' })
    expect(invite).toHaveTextContent('19 a 25 de out.')
    expect(invite).toHaveTextContent('1 dia feito · 1 tarefa')
    expect(screen.getByRole('link', { name: 'Revisar' })).toHaveAttribute('href', '/revisao')
  })
})
