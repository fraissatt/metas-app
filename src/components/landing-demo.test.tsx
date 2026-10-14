import { describe, expect, it } from 'vitest'
import { createEvent, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LandingDemo } from '@/components/landing-demo'
import { buildLandingDemo } from '@/lib/landing-demo'

// Wednesday 14/10/2026: Monday and Tuesday are done, Wednesday (today) is open.
// The vocabulary goal has 5 tasks (2 done), the conversation goal 4 (1 done).
const data = buildLandingDemo(new Date('2026-10-14T15:00:00Z'))
const ANKI = 'Revisar 20 cartões no Anki'

const layer = (name: 'objective' | 'week' | 'today') => {
  const element = document.querySelector(`[data-view="${name}"]`)
  if (!element) throw new Error(`no ${name} layer`)
  return within(element as HTMLElement)
}

describe('LandingDemo', () => {
  it('is a labelled region holding the three views, stacked', () => {
    render(<LandingDemo data={data} step={0} />)
    expect(screen.getByRole('region', { name: 'Demonstração interativa' })).toBeInTheDocument()
    expect(document.querySelectorAll('[data-view]')).toHaveLength(3)
  })

  it('only the view of the active step can be reached: the others are inert and hidden', () => {
    const { rerender } = render(<LandingDemo data={data} step={0} />)
    const flags = () =>
      ['objective', 'week', 'today'].map((name) => document.querySelector(`[data-view="${name}"]`)?.hasAttribute('inert'))
    expect(flags()).toEqual([false, true, true])
    rerender(<LandingDemo data={data} step={2} />)
    expect(flags()).toEqual([true, true, false])
    expect(document.querySelector('[data-view="objective"]')).toHaveAttribute('aria-hidden', 'true')
    expect(document.querySelector('[data-view="today"]')).not.toHaveAttribute('aria-hidden', 'true')
  })

  it('the objective view shows the deadline, the earlier weeks and this week', () => {
    render(<LandingDemo data={data} step={0} />)
    const view = layer('objective')
    expect(view.getByText('Falar inglês com fluência')).toBeInTheDocument()
    expect(view.getByText(/Prazo:/)).toBeInTheDocument()
    expect(view.getByText('3 de 9 tarefas da semana concluídas')).toBeInTheDocument()
    expect(view.getByText('5 de 6 semanas cumpridas · sequência de 4')).toBeInTheDocument()
    expect(view.getAllByTestId('week-bar')).toHaveLength(7)
  })

  it('the week view shows the goals with their progress ring', () => {
    render(<LandingDemo data={data} step={1} />)
    const view = layer('week')
    expect(view.getByText('Estudar vocabulário todos os dias')).toBeInTheDocument()
    expect(view.getByText('Praticar conversação')).toBeInTheDocument()
    expect(view.getAllByTestId('progress-ring')).toHaveLength(2)
    expect(view.getByText('40%')).toBeInTheDocument()
  })

  it("the Hoje view shows today's tasks as checkboxes, all open, with no edit menu", () => {
    render(<LandingDemo data={data} step={2} />)
    const view = layer('today')
    expect(view.getByRole('checkbox', { name: ANKI })).not.toBeChecked()
    expect(view.getByRole('checkbox', { name: 'Ouvir podcast em inglês no trajeto' })).not.toBeChecked()
    expect(screen.queryByText('⋯')).toBeNull()
  })

  it('ticking a task completes the day for its goal', async () => {
    render(<LandingDemo data={data} step={2} />)
    await userEvent.click(layer('today').getByRole('checkbox', { name: ANKI }))
    expect(layer('today').getByRole('checkbox', { name: ANKI })).toBeChecked()
    expect(layer('today').getByText('✓ feito')).toBeInTheDocument()
  })

  it('shares the tasks between the views: a tick in Hoje moves the week and the objective', async () => {
    const { rerender } = render(<LandingDemo data={data} step={2} />)
    await userEvent.click(layer('today').getByRole('checkbox', { name: ANKI }))
    rerender(<LandingDemo data={data} step={1} />)
    expect(layer('week').getByText('60%')).toBeInTheDocument()
    rerender(<LandingDemo data={data} step={0} />)
    expect(layer('objective').getByText('4 de 9 tarefas da semana concluídas')).toBeInTheDocument()
  })

  it('unticking reverts', async () => {
    render(<LandingDemo data={data} step={2} />)
    const checkbox = () => layer('today').getByRole('checkbox', { name: ANKI })
    await userEvent.click(checkbox())
    await userEvent.click(checkbox())
    expect(checkbox()).not.toBeChecked()
    expect(layer('today').queryByText('✓ feito')).toBeNull()
  })

  it('shows a hint until the first tick, and Recomeçar brings back the data and the hint', async () => {
    render(<LandingDemo data={data} step={2} />)
    expect(screen.getByText('Experimente: marque uma tarefa')).toBeInTheDocument()

    await userEvent.click(layer('today').getByRole('checkbox', { name: ANKI }))
    expect(screen.queryByText('Experimente: marque uma tarefa')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Recomeçar' }))
    expect(layer('today').getByRole('checkbox', { name: ANKI })).not.toBeChecked()
    expect(screen.getByText('Experimente: marque uma tarefa')).toBeInTheDocument()
  })

  it('keeps every link inside the demo inert', () => {
    render(<LandingDemo data={data} step={1} />)
    const links = screen.getAllByRole('link', { hidden: true })
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) {
      expect(link).toHaveAttribute('tabindex', '-1')
      const click = createEvent.click(link)
      fireEvent(link, click)
      expect(click.defaultPrevented).toBe(true)
    }
  })
})
