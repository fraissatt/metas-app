import { describe, expect, it, vi } from 'vitest'
import { createEvent, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DemoStateProvider } from '@/components/landing-demo-state'
import { DemoCard } from '@/components/landing-demo-views'
import { buildLandingDemo } from '@/lib/landing-demo'

// Wednesday 14/10/2026: Monday and Tuesday are done, Wednesday (today) is open.
// The vocabulary goal has 5 tasks (2 done), the conversation goal 4 (1 done).
const data = buildLandingDemo(new Date('2026-10-14T15:00:00Z'))
const WORDS = 'Aprender 10 palavras novas'
const LABELS = ['Demonstração: Objetivo', 'Demonstração: Meta da semana', 'Demonstração: Tarefa do dia']

function renderCards(indexes: (0 | 1 | 2)[] = [0, 1, 2]) {
  return render(
    <DemoStateProvider data={data}>
      {indexes.map((index) => (
        <DemoCard key={index} index={index} data={data} label={LABELS[index]} />
      ))}
    </DemoStateProvider>,
  )
}

const card = (index: number) => within(screen.getByRole('group', { name: LABELS[index] }))

describe('DemoCard', () => {
  it('is a group named after its step', () => {
    renderCards()
    for (const label of LABELS) expect(screen.getByRole('group', { name: label })).toBeInTheDocument()
  })

  it('the objective card shows the deadline, the earlier weeks and this week', () => {
    renderCards()
    const view = card(0)
    expect(view.getByText('Falar inglês com fluência')).toBeInTheDocument()
    expect(view.getByText(/Prazo:/)).toBeInTheDocument()
    expect(view.getByText('3 de 9 tarefas da semana concluídas')).toBeInTheDocument()
    expect(view.getByText('5 de 6 semanas cumpridas · sequência de 4')).toBeInTheDocument()
    expect(view.getAllByTestId('week-bar')).toHaveLength(7)
  })

  it('the objective card has no coloured strip on its left edge', () => {
    const { container } = renderCards([0])

    expect(container.querySelector('.w-\\[3px\\]')).toBeNull()
  })

  it('the week card and the day card gather their goals in one panel each', () => {
    renderCards()

    for (const index of [1, 2]) {
      const panel = screen.getByRole('group', { name: LABELS[index] }).querySelector('.divide-y')
      expect(panel, 'panel of card ' + index).not.toBeNull()
      expect(panel?.children.length, 'rows of card ' + index).toBeGreaterThanOrEqual(2)
    }
  })

  it('the week card shows the goals with their progress ring', () => {
    renderCards()
    const view = card(1)
    expect(view.getByText('Estudar vocabulário todos os dias')).toBeInTheDocument()
    expect(view.getByText('Praticar conversação')).toBeInTheDocument()
    expect(view.getAllByTestId('progress-ring')).toHaveLength(2)
    expect(view.getByText('40%')).toBeInTheDocument()
  })

  it("the Hoje card shows today's tasks as checkboxes, all open, with no edit menu", () => {
    renderCards()
    const view = card(2)
    expect(view.getByRole('checkbox', { name: WORDS })).not.toBeChecked()
    expect(view.getByRole('checkbox', { name: 'Ouvir podcast em inglês no trajeto' })).not.toBeChecked()
    expect(screen.queryByText('⋯')).toBeNull()
  })

  it('ticking a task completes the day for its goal', async () => {
    renderCards([2])
    await userEvent.click(card(2).getByRole('checkbox', { name: WORDS }))
    await waitFor(() => expect(card(2).getByRole('checkbox', { name: WORDS })).toBeChecked())
    expect(await card(2).findByText('✓ feito')).toBeInTheDocument()
  })

  it('shares the tasks between the cards: a tick in Hoje moves the week and the objective', async () => {
    renderCards()
    await userEvent.click(card(2).getByRole('checkbox', { name: WORDS }))
    await waitFor(() => expect(card(2).getByRole('checkbox', { name: WORDS })).toBeChecked())
    expect(card(1).getByText('60%')).toBeInTheDocument()
    expect(card(0).getByText('4 de 9 tarefas da semana concluídas')).toBeInTheDocument()
  })

  it('unticking reverts', async () => {
    renderCards([2])
    const checkbox = () => card(2).getByRole('checkbox', { name: WORDS })
    await userEvent.click(checkbox())
    await waitFor(() => expect(checkbox()).toBeChecked())
    await userEvent.click(checkbox())
    await waitFor(() => expect(checkbox()).not.toBeChecked())
    expect(card(2).queryByText('✓ feito')).toBeNull()
  })

  it('shows a hint under the Hoje card until the first tick, and Recomeçar brings back the data and the hint', async () => {
    renderCards()
    expect(screen.getByText('Experimente: marque uma tarefa')).toBeInTheDocument()

    await userEvent.click(card(2).getByRole('checkbox', { name: WORDS }))
    await waitFor(() => expect(screen.queryByText('Experimente: marque uma tarefa')).toBeNull())

    await userEvent.click(screen.getByRole('button', { name: 'Recomeçar' }))
    await waitFor(() => expect(card(2).getByRole('checkbox', { name: WORDS })).not.toBeChecked())
    expect(screen.getByText('Experimente: marque uma tarefa')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ver a Meta da semana' })).toBeNull()
  })

  it('after the first tick, points the visitor back to the week card, and the pointer scrolls there', async () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    renderCards()
    expect(screen.queryByRole('button', { name: 'Ver a Meta da semana' })).toBeNull()

    await userEvent.click(card(2).getByRole('checkbox', { name: WORDS }))
    expect(await screen.findByText(/Feito!/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Ver a Meta da semana' }))
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView.mock.contexts[0]).toBe(screen.getByRole('group', { name: LABELS[1] }))
  })

  it('keeps every link inside the cards inert', () => {
    renderCards()
    const links = screen.getAllByRole('link')
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) {
      expect(link).toHaveAttribute('tabindex', '-1')
      const click = createEvent.click(link)
      fireEvent(link, click)
      expect(click.defaultPrevented).toBe(true)
    }
  })
})
