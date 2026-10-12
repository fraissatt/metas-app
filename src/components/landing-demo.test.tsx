import { describe, expect, it } from 'vitest'
import { createEvent, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LandingDemo } from '@/components/landing-demo'
import { buildLandingDemo } from '@/lib/landing-demo'

// Wednesday 14/10/2026: Monday and Tuesday are done, Wednesday (today) is open.
// The vocabulary goal has 5 tasks (2 done), the conversation goal 4 (1 done).
const data = buildLandingDemo(new Date('2026-10-14T15:00:00Z'))
const ANKI = 'Revisar 20 cartões no Anki'

describe('LandingDemo', () => {
  it('is a labelled region', () => {
    render(<LandingDemo data={data} step={2} />)
    expect(screen.getByRole('region', { name: 'Demonstração interativa' })).toBeInTheDocument()
  })

  it('step 1 shows the objective with its deadline and progress', () => {
    render(<LandingDemo data={data} step={0} />)
    expect(screen.getByText('Falar inglês com fluência')).toBeInTheDocument()
    expect(screen.getByText(/Prazo:/)).toBeInTheDocument()
    expect(screen.getByText('3 de 9 tarefas da semana concluídas')).toBeInTheDocument()
  })

  it('step 2 shows the week goals with their progress ring', () => {
    render(<LandingDemo data={data} step={1} />)
    expect(screen.getByText('Estudar vocabulário todos os dias')).toBeInTheDocument()
    expect(screen.getByText('Praticar conversação')).toBeInTheDocument()
    expect(screen.getAllByTestId('progress-ring')).toHaveLength(2)
    expect(screen.getByText('40%')).toBeInTheDocument()
  })

  it("step 3 shows today's tasks as checkboxes, all open, with no edit menu", () => {
    render(<LandingDemo data={data} step={2} />)
    expect(screen.getByRole('checkbox', { name: ANKI })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Ouvir podcast em inglês no trajeto' })).not.toBeChecked()
    expect(screen.queryByText('⋯')).toBeNull()
  })

  it('ticking a task completes the day for its goal', async () => {
    render(<LandingDemo data={data} step={2} />)
    await userEvent.click(screen.getByRole('checkbox', { name: ANKI }))
    expect(screen.getByRole('checkbox', { name: ANKI })).toBeChecked()
    expect(screen.getByText('✓ feito')).toBeInTheDocument()
  })

  it('shares the tasks between the views: a tick in Hoje moves the week progress', async () => {
    const { rerender } = render(<LandingDemo data={data} step={2} />)
    await userEvent.click(screen.getByRole('checkbox', { name: ANKI }))
    rerender(<LandingDemo data={data} step={1} />)
    expect(screen.getByText('60%')).toBeInTheDocument()
    rerender(<LandingDemo data={data} step={0} />)
    expect(screen.getByText('4 de 9 tarefas da semana concluídas')).toBeInTheDocument()
  })

  it('unticking reverts', async () => {
    render(<LandingDemo data={data} step={2} />)
    await userEvent.click(screen.getByRole('checkbox', { name: ANKI }))
    await userEvent.click(screen.getByRole('checkbox', { name: ANKI }))
    expect(screen.getByRole('checkbox', { name: ANKI })).not.toBeChecked()
    expect(screen.queryByText('✓ feito')).toBeNull()
  })

  it('shows a hint until the first tick, and Recomeçar brings back the data and the hint', async () => {
    render(<LandingDemo data={data} step={2} />)
    expect(screen.getByText('Experimente: marque uma tarefa')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('checkbox', { name: ANKI }))
    expect(screen.queryByText('Experimente: marque uma tarefa')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Recomeçar' }))
    expect(screen.getByRole('checkbox', { name: ANKI })).not.toBeChecked()
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
