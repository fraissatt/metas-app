import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LandingFlow } from '@/components/landing-flow'
import { buildLandingDemo } from '@/lib/landing-demo'

const data = buildLandingDemo(new Date('2026-10-14T15:00:00Z'))
const WORDS = 'Aprender 10 palavras novas'

// The steps' vertical centres at scroll 0; scrolling moves them up. With the
// reference line at 400 (half of an 800 px window), the progress is 0
// at scroll 500, 1 at scroll 1100 and 2 at scroll 1700.
const BASE = [900, 1500, 2100]
let scroll = 0
let reduceMotion = false

function scrollTo(y: number) {
  scroll = y
  act(() => {
    fireEvent.scroll(window)
  })
}

// Card tops at scroll 0; a card is fully revealed once its top is 240 px from the top of an 800 px window.
const CARD_TOP = [1000, 1700, 2300]

const card = (index: number) => within(document.querySelector(`[data-card="${index}"]`) as HTMLElement)
const list = () => screen.getByRole('list', { name: 'Como funciona' })
const container = () => list().parentElement as HTMLElement
const steps = () => within(list()).getAllByRole('listitem')
const progress = () => Number(container().style.getPropertyValue('--p'))
const weight = (index: number) => container().style.getPropertyValue(`--v${index}`)

beforeEach(() => {
  scroll = 0
  reduceMotion = false
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('reduce') && reduceMotion,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }))
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0)
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.dataset.card !== undefined) {
      const top = CARD_TOP[Number(this.dataset.card)] - scroll
      return { top, bottom: top + 300, height: 300, left: 0, right: 0, width: 0, x: 0, y: top } as DOMRect
    }
    const index = this.dataset.step === undefined ? -1 : Number(this.dataset.step)
    const centre = index >= 0 ? BASE[index] - scroll : 0
    return { top: centre - 50, bottom: centre + 50, height: 100, left: 0, right: 0, width: 0, x: 0, y: centre - 50 } as DOMRect
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('LandingFlow', () => {
  it('lists the three steps in an ordered list, the first one active before any scroll', () => {
    render(<LandingFlow data={data} />)
    expect(list().tagName).toBe('OL')
    expect(steps()).toHaveLength(3)
    expect(steps()[0]).toHaveAttribute('aria-current', 'step')
    expect(steps()[1]).not.toHaveAttribute('aria-current')
    expect(weight(0)).toBe('1')
    expect(screen.getByText('Passo 1 de 3: Objetivo')).toBeInTheDocument()
  })

  it('gives each step its screen, its example from the demo and two points', () => {
    render(<LandingFlow data={data} />)
    const inSteps = within(list())
    expect(inSteps.getByText('Tela: Objetivos')).toBeInTheDocument()
    expect(inSteps.getByText('Tela: Semana')).toBeInTheDocument()
    expect(inSteps.getByText('Tela: Hoje')).toBeInTheDocument()
    expect(inSteps.getByText('Falar inglês com fluência, até 15/02/2027')).toBeInTheDocument()
    expect(within(steps()[1]).getAllByText('Estudar vocabulário todos os dias').length).toBeGreaterThan(0)
    expect(inSteps.getByText(`${WORDS}, hoje`)).toBeInTheDocument()
    expect(inSteps.getByText('Prazo e tempo decorrido')).toBeInTheDocument()
    expect(inSteps.getByText('Marque no dia e veja o progresso mudar')).toBeInTheDocument()
  })

  it('fades the step highlight out as the reader leaves it, before the next one appears', () => {
    render(<LandingFlow data={data} />)
    scrollTo(700)
    expect(progress()).toBeCloseTo(1 / 3, 2)
    expect(Number(weight(0))).toBeCloseTo(2 / 3, 2)
    expect(weight(1)).toBe('0')
    expect(weight(2)).toBe('0')
    expect(steps()[0]).toHaveAttribute('aria-current', 'step')
    scrollTo(800)
    expect([weight(0), weight(1), weight(2)]).toEqual(['0', '0', '0'])
    scrollTo(900)
    expect(weight(0)).toBe('0')
    expect(Number(weight(1))).toBeCloseTo(2 / 3, 2)
  })

  it('highlights exactly one step, when a step is on the reference line', () => {
    render(<LandingFlow data={data} />)
    scrollTo(1100)
    expect(progress()).toBe(1)
    expect([weight(0), weight(1), weight(2)]).toEqual(['0', '1', '0'])
    expect(steps()[1]).toHaveAttribute('aria-current', 'step')
    expect(screen.getByText('Passo 2 de 3: Meta da semana')).toBeInTheDocument()
  })

  it('marks the last step as current at the end', () => {
    render(<LandingFlow data={data} />)
    scrollTo(1700)
    expect(progress()).toBe(2)
    expect(steps()[2]).toHaveAttribute('aria-current', 'step')
    expect(screen.getByText('Passo 3 de 3: Tarefa do dia')).toBeInTheDocument()
  })

  it('switches at once, with no blending, when motion is reduced', () => {
    reduceMotion = true
    render(<LandingFlow data={data} />)
    scrollTo(700)
    expect([weight(0), weight(1), weight(2)]).toEqual(['1', '0', '0'])
    scrollTo(900)
    expect([weight(0), weight(1), weight(2)]).toEqual(['0', '1', '0'])
  })

  it('keeps the tasks the visitor ticked while the page scrolls', async () => {
    render(<LandingFlow data={data} />)
    scrollTo(1700)
    await userEvent.click(card(2).getByRole('checkbox', { name: WORDS }))
    await waitFor(() => expect(card(2).getByRole('checkbox', { name: WORDS })).toBeChecked())
    scrollTo(1100)
    scrollTo(1700)
    expect(card(2).getByRole('checkbox', { name: WORDS })).toBeChecked()
  })

  it('stays on step 1 where the layout is not available', () => {
    vi.restoreAllMocks() // every step reports a zero box, as in a bare DOM
    render(<LandingFlow data={data} />)
    scrollTo(0)
    expect(screen.getByText('Passo 1 de 3: Objetivo')).toBeInTheDocument()
    expect(weight(0)).toBe('1')
  })

  it('stops listening to the scroll when it goes away', () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    const { unmount } = render(<LandingFlow data={data} />)
    unmount()
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function))
    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function))
  })

  it('puts one named card inside each step, on every screen size', () => {
    render(<LandingFlow data={data} />)
    for (const index of [0, 1, 2]) {
      const element = document.querySelector(`[data-card="${index}"]`) as HTMLElement
      expect(element).toHaveAttribute('role', 'group')
      expect(element).not.toHaveClass('lg:hidden')
      expect(steps()[index]).toContainElement(element)
    }
    expect(within(steps()[1]).getByRole('group', { name: 'Demonstração: Meta da semana' })).toBeInTheDocument()
  })

  it('counts the first card up with the scroll, to the real numbers', () => {
    render(<LandingFlow data={data} />)
    expect(card(0).getByText('0% do prazo decorrido')).toBeInTheDocument()
    expect(card(0).getByText('0 de 9 tarefas da semana concluídas')).toBeInTheDocument()
    scrollTo(500) // the card's top is at 500: 54% of the way
    expect(card(0).getByText('14% do prazo decorrido')).toBeInTheDocument()
    scrollTo(760)
    expect(card(0).getByText('26% do prazo decorrido')).toBeInTheDocument()
    expect(card(0).getByText('3 de 9 tarefas da semana concluídas')).toBeInTheDocument()
    expect(card(0).getByText('5 de 6 semanas cumpridas · sequência de 4')).toBeInTheDocument()
  })

  it('fills the week card smoothly as it enters, both goals moving and with no glow on the way', () => {
    render(<LandingFlow data={data} />)
    scrollTo(1300) // 71% of the way: 40% and 25% become 29% and 18%
    expect(card(1).getByText('29%')).toBeInTheDocument()
    expect(card(1).getByText('18%')).toBeInTheDocument()
    expect(card(1).queryAllByTestId('goal-glow')).toHaveLength(0)
  })

  it('keeps the current week bar of the objective free of any glow, rising or arrived', () => {
    render(<LandingFlow data={data} />)
    scrollTo(500)
    const bars = () => card(0).getAllByTestId('week-bar')
    expect(bars().at(-1)?.style.boxShadow).toBe('')
    scrollTo(760)
    expect(bars().at(-1)?.style.boxShadow).toBe('')
  })

  it('fills the week card as it enters: the rings go from 0 to the real percentages', () => {
    render(<LandingFlow data={data} />)
    expect(card(1).getAllByText('0%')).toHaveLength(2)
    scrollTo(1460)
    expect(card(1).getByText('40%')).toBeInTheDocument()
    expect(card(1).getByText('25%')).toBeInTheDocument()
  })

  it('keeps one set of tasks for the cards: a tick in the Hoje card moves the week card', async () => {
    render(<LandingFlow data={data} />)
    scrollTo(2060)
    await userEvent.click(card(2).getByRole('checkbox', { name: WORDS }))
    await waitFor(() => expect(card(2).getByRole('checkbox', { name: WORDS })).toBeChecked())
    expect(card(1).getByText('60%')).toBeInTheDocument()
  })

  it('has no sticky panel: the steps are plain rows', () => {
    render(<LandingFlow data={data} />)
    expect(container().querySelector('.sticky')).toBeNull()
  })
})
