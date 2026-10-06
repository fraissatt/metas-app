import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OnboardingQuiz } from '@/components/onboarding-quiz'
import type { FunnelEventInput } from '@/lib/actions/funnel'

type Props = Parameters<typeof OnboardingQuiz>[0]

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

function setup(overrides: Partial<Props> = {}, strict = false) {
  const onTrack = overrides.onTrack ?? vi.fn<Props['onTrack']>().mockResolvedValue(undefined)
  const onCreate = overrides.onCreate ?? vi.fn<Props['onCreate']>().mockResolvedValue(undefined)
  const user = userEvent.setup()
  const ui = <OnboardingQuiz onTrack={onTrack} onCreate={onCreate} />
  render(strict ? <StrictMode>{ui}</StrictMode> : ui)
  return { onTrack: vi.mocked(onTrack), onCreate: vi.mocked(onCreate), user }
}

type User = ReturnType<typeof userEvent.setup>

const next = (user: User) => user.click(screen.getByRole('button', { name: 'Continuar' }))
const pick = (user: User, name: string) => user.click(screen.getByRole('radio', { name }))

async function walkToResult(user: User) {
  await pick(user, 'Saúde e corpo')
  await next(user)
  await pick(user, 'Correr uma prova')
  await next(user)
  await pick(user, '3 meses')
  await next(user)
  await user.click(screen.getByRole('checkbox', { name: 'Seg' }))
  await user.click(screen.getByRole('checkbox', { name: 'Qua' }))
  await user.click(screen.getByRole('checkbox', { name: 'Sex' }))
  await next(user)
  await pick(user, 'Falta de constância')
  await next(user)
}

let ids: string[]

beforeEach(() => {
  let n = 0
  ids = []
  vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
    const id = `session-test-${String(++n).padStart(4, '0')}` as `${string}-${string}-${string}-${string}-${string}`
    ids.push(id)
    return id
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('OnboardingQuiz', () => {
  it('walks all five steps with the mouse and reaches the result', async () => {
    const { user } = setup()

    expect(screen.getByText('Etapa 1 de 5')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'O que você quer conquistar?' })).toBeInTheDocument()
    await pick(user, 'Saúde e corpo')
    await next(user)

    expect(screen.getByText('Etapa 2 de 5')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Na saúde, qual é o seu foco?' })).toBeInTheDocument()
    await pick(user, 'Correr uma prova')
    await next(user)

    expect(screen.getByText('Etapa 3 de 5')).toBeInTheDocument()
    await pick(user, '3 meses')
    await next(user)

    expect(screen.getByText('Etapa 4 de 5')).toBeInTheDocument()
    expect(screen.getByRole('group')).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Seg' }))
    await next(user)

    expect(screen.getByText('Etapa 5 de 5')).toBeInTheDocument()
    await pick(user, 'Perco a motivação')
    await next(user)

    expect(screen.getByText('Seu plano está pronto')).toBeInTheDocument()
  })

  it('branches the foco options on the chosen area', async () => {
    const { user } = setup()

    await pick(user, 'Finanças')
    await next(user)

    expect(screen.getByRole('heading', { level: 1, name: 'Nas finanças, qual é o seu foco?' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual([
      'Montar uma reserva',
      'Sair das dívidas',
      'Organizar os gastos',
    ])
  })

  it('keeps the previous answers when going back', async () => {
    const { user } = setup()

    await pick(user, 'Estudos')
    await next(user)
    await pick(user, 'Aprender um idioma')
    await next(user)
    await user.click(screen.getByRole('button', { name: /Voltar/ }))

    expect(screen.getByText('Etapa 2 de 5')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Aprender um idioma' })).toHaveAttribute('aria-checked', 'true')

    await user.click(screen.getByRole('button', { name: /Voltar/ }))
    expect(screen.getByRole('radio', { name: 'Estudos' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByRole('button', { name: /Voltar/ })).not.toBeInTheDocument()
  })

  it('requires at least one day before continuing from the dias step', async () => {
    const { user } = setup()
    await pick(user, 'Saúde e corpo')
    await next(user)
    await pick(user, 'Correr uma prova')
    await next(user)
    await pick(user, '3 meses')
    await next(user)

    await next(user)
    expect(screen.getByText('Etapa 4 de 5')).toBeInTheDocument()
    expect(screen.getByText('Escolha pelo menos um dia')).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: 'Ter' }))
    expect(screen.getByRole('checkbox', { name: 'Ter' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByText('Escolha pelo menos um dia')).not.toBeInTheDocument()

    await next(user)
    expect(screen.getByText('Etapa 5 de 5')).toBeInTheDocument()
  })

  it('does not advance a single-choice step without an answer', async () => {
    const { user } = setup()

    await next(user)

    expect(screen.getByText('Etapa 1 de 5')).toBeInTheDocument()
    expect(screen.getByText('Escolha uma opção')).toBeInTheDocument()
  })

  it('shows the plan on the result screen', async () => {
    const { user } = setup()

    await walkToResult(user)

    expect(screen.getByText('Seu plano está pronto')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Correr uma prova de 10 km' })).toBeInTheDocument()
    expect(screen.getByText(/^Meta para \d{2}\/\d{2}\/\d{4} · 3 meses$/)).toBeInTheDocument()
    expect(screen.getByText('Correr 3 vezes na semana')).toBeInTheDocument()
    expect(screen.getByText('repete toda semana')).toBeInTheDocument()
    expect(screen.getByText('Seg · Caminhar e correr leve por 20 minutos')).toBeInTheDocument()
    expect(screen.getByText('Qua · Corrida contínua de 30 minutos')).toBeInTheDocument()
    expect(screen.getByText('Sex · Treino de ritmo: 5 tiros de 1 minuto')).toBeInTheDocument()
    expect(screen.getByText('A meta se repete toda semana para virar hábito.')).toBeInTheDocument()
  })

  it('calls onCreate with the session id and answers and shows a busy state', async () => {
    const pending = deferred()
    const { user, onCreate } = setup({ onCreate: vi.fn().mockReturnValue(pending.promise) })
    await walkToResult(user)

    await user.click(screen.getByRole('button', { name: 'Criar meu plano' }))

    expect(onCreate).toHaveBeenCalledWith({
      sessionId: ids[0],
      answers: {
        area: 'saude',
        foco: 'correr',
        prazo: 3,
        dias: ['seg', 'qua', 'sex'],
        obstaculo: 'constancia',
      },
    })
    const busy = screen.getByRole('button', { name: /Criando/ })
    expect(busy).toHaveAttribute('aria-disabled', 'true')
    expect(busy).toHaveFocus()
    pending.resolve()
  })

  it('ignores a second click while the plan is being created', async () => {
    const pending = deferred()
    const { user, onCreate } = setup({ onCreate: vi.fn().mockReturnValue(pending.promise) })
    await walkToResult(user)

    const button = screen.getByRole('button', { name: 'Criar meu plano' })
    await user.dblClick(button)
    await user.click(button)

    expect(onCreate).toHaveBeenCalledTimes(1)
    pending.resolve()
  })

  it('shows an error and re-enables the button when onCreate rejects', async () => {
    const onCreate = vi.fn<Props['onCreate']>().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(undefined)
    const { user } = setup({ onCreate })
    await walkToResult(user)

    await user.click(screen.getByRole('button', { name: 'Criar meu plano' }))

    expect(await screen.findByText('Não foi possível criar o plano. Tente de novo.')).toBeInTheDocument()
    const retry = screen.getByRole('button', { name: 'Criar meu plano' })
    expect(retry).toBeEnabled()
    expect(retry).not.toHaveAttribute('aria-disabled', 'true')

    await user.click(retry)
    expect(onCreate).toHaveBeenCalledTimes(2)
  })

  it('restarts with a new session id and cleared answers on Refazer', async () => {
    const { user, onTrack } = setup()
    await walkToResult(user)

    await user.click(screen.getByRole('button', { name: 'Refazer' }))

    expect(screen.getByText('Etapa 1 de 5')).toBeInTheDocument()
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toHaveAttribute('aria-checked', 'false')
    }
    expect(ids).toHaveLength(2)
    await waitFor(() =>
      expect(onTrack).toHaveBeenLastCalledWith({ sessionId: ids[1], type: 'step_viewed', step: 'area' }),
    )
    expect(onTrack).toHaveBeenCalledWith({ sessionId: ids[1], type: 'quiz_started' })
  })

  it('sends the funnel events in order with one session id', async () => {
    const { user, onTrack } = setup()
    await walkToResult(user)

    const s = ids[0]
    const expected: FunnelEventInput[] = [
      { sessionId: s, type: 'quiz_started' },
      { sessionId: s, type: 'step_viewed', step: 'area' },
      { sessionId: s, type: 'step_answered', step: 'area', value: 'saude' },
      { sessionId: s, type: 'step_viewed', step: 'foco' },
      { sessionId: s, type: 'step_answered', step: 'foco', value: 'correr' },
      { sessionId: s, type: 'step_viewed', step: 'prazo' },
      { sessionId: s, type: 'step_answered', step: 'prazo', value: '3' },
      { sessionId: s, type: 'step_viewed', step: 'dias' },
      { sessionId: s, type: 'step_answered', step: 'dias', value: 'seg,qua,sex' },
      { sessionId: s, type: 'step_viewed', step: 'obstaculo' },
      { sessionId: s, type: 'step_answered', step: 'obstaculo', value: 'constancia' },
      { sessionId: s, type: 'result_viewed' },
    ]
    await waitFor(() => expect(onTrack).toHaveBeenCalledTimes(expected.length))
    expect(onTrack.mock.calls.map(([e]) => e)).toEqual(expected)
  })

  it('tracks step_viewed again after Voltar', async () => {
    const { user, onTrack } = setup()
    await pick(user, 'Estudos')
    await next(user)
    await user.click(screen.getByRole('button', { name: /Voltar/ }))

    await waitFor(() => expect(onTrack).toHaveBeenCalledTimes(5))
    expect(onTrack.mock.calls.at(-1)![0]).toEqual({ sessionId: ids[0], type: 'step_viewed', step: 'area' })
  })

  it('serializes tracking calls: the next starts only after the previous settles', async () => {
    const first = deferred()
    const second = deferred()
    const onTrack = vi
      .fn<Props['onTrack']>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
      .mockResolvedValue(undefined)
    const { user } = setup({ onTrack })

    await waitFor(() => expect(onTrack).toHaveBeenCalledTimes(1))
    await pick(user, 'Estudos')
    await next(user)
    expect(onTrack).toHaveBeenCalledTimes(1)

    first.resolve()
    await waitFor(() => expect(onTrack).toHaveBeenCalledTimes(2))
    expect(onTrack).toHaveBeenCalledTimes(2)

    second.resolve()
    await waitFor(() => expect(onTrack).toHaveBeenCalledTimes(4))
    expect(onTrack.mock.calls.map(([e]) => e.type)).toEqual([
      'quiz_started',
      'step_viewed',
      'step_answered',
      'step_viewed',
    ])
  })

  it('keeps working when onTrack rejects', async () => {
    const onTrack = vi.fn<Props['onTrack']>().mockRejectedValue(new Error('offline'))
    const { user } = setup({ onTrack })

    await pick(user, 'Estudos')
    await next(user)
    expect(screen.getByText('Etapa 2 de 5')).toBeInTheDocument()

    await pick(user, 'Fazer um curso')
    await next(user)
    expect(screen.getByText('Etapa 3 de 5')).toBeInTheDocument()
    await waitFor(() => expect(onTrack.mock.calls.length).toBeGreaterThanOrEqual(6))
  })

  it('moves the selection with the arrow keys inside the radiogroup', async () => {
    const { user } = setup()
    const radios = screen.getAllByRole('radio')

    radios[0].focus()
    await user.keyboard('{ArrowDown}')

    expect(radios[1]).toHaveAttribute('aria-checked', 'true')
    expect(radios[1]).toHaveFocus()
    expect(radios[1]).toHaveAttribute('tabindex', '0')
    expect(radios[0]).toHaveAttribute('tabindex', '-1')

    await user.keyboard('{ArrowUp}{ArrowUp}')
    expect(radios[radios.length - 1]).toHaveAttribute('aria-checked', 'true')
  })

  it('continues on Enter from a single-choice option and focuses the new heading', async () => {
    const { user } = setup()
    const radios = screen.getAllByRole('radio')

    radios[0].focus()
    await user.keyboard('{ArrowDown}{Enter}')

    expect(screen.getByText('Etapa 2 de 5')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus()
  })

  it('lets Space toggle days and arrows move focus without toggling', async () => {
    const { user } = setup()
    await pick(user, 'Saúde e corpo')
    await next(user)
    await pick(user, 'Correr uma prova')
    await next(user)
    await pick(user, '3 meses')
    await next(user)

    const days = screen.getAllByRole('checkbox')
    days[0].focus()
    await user.keyboard('{ArrowRight}')
    expect(days[1]).toHaveFocus()
    expect(days[1]).toHaveAttribute('aria-checked', 'false')

    await user.keyboard(' ')
    expect(days[1]).toHaveAttribute('aria-checked', 'true')
  })
  it('still renders and tracks a valid session id when crypto.randomUUID is unavailable', async () => {
    vi.stubGlobal('crypto', { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) })
    const { onTrack } = setup()

    expect(screen.getByText('Etapa 1 de 5')).toBeInTheDocument()
    await waitFor(() => expect(onTrack).toHaveBeenCalledTimes(2))
    const id = onTrack.mock.calls[0][0].sessionId
    expect(id).toMatch(/^[A-Za-z0-9-]{8,40}$/)
  })

  it('does not render the step counter on the result screen', async () => {
    const { user } = setup()
    await walkToResult(user)

    expect(screen.getByText('Seu plano está pronto')).toBeInTheDocument()
    expect(screen.queryByText(/Etapa \d de 5/)).not.toBeInTheDocument()
  })

  it('labels the option group with the question heading', () => {
    setup()
    expect(screen.getByRole('radiogroup', { name: 'O que você quer conquistar?' })).toBeInTheDocument()
    expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-labelledby')
    expect(screen.getByRole('radiogroup')).not.toHaveAttribute('aria-label')
  })

  it('does not move focus to the heading on mount, even under StrictMode', () => {
    setup({}, true)
    expect(screen.getByRole('heading', { level: 1 })).not.toHaveFocus()
  })

  it('resets the foco options when the area changes after going back', async () => {
    const { user } = setup()
    await pick(user, 'Saúde e corpo')
    await next(user)
    await pick(user, 'Correr uma prova')
    await user.click(screen.getByRole('button', { name: /Voltar/ }))
    await pick(user, 'Estudos')
    await next(user)

    expect(screen.getByRole('heading', { level: 1, name: 'Nos estudos, qual é o seu foco?' })).toBeInTheDocument()
    const radios = screen.getAllByRole('radio')
    expect(radios.map((r) => r.textContent)).toEqual(['Ler mais livros', 'Aprender um idioma', 'Fazer um curso'])
    for (const radio of radios) expect(radio).toHaveAttribute('aria-checked', 'false')
  })

  describe('result when the chosen days have all passed this week', () => {
    async function walkWithDays(user: User, days: string[]) {
      await pick(user, 'Saúde e corpo')
      await next(user)
      await pick(user, 'Correr uma prova')
      await next(user)
      await pick(user, '3 meses')
      await next(user)
      for (const day of days) await user.click(screen.getByRole('checkbox', { name: day }))
      await next(user)
      await pick(user, 'Falta de constância')
      await next(user)
    }

    it('tells the user the plan starts next Monday', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-10-08T12:00:00-03:00')) // Thursday
      const { user } = setup()
      await walkWithDays(user, ['Seg', 'Ter'])

      expect(screen.getByText('Começa na segunda, 12/10')).toBeInTheDocument()
      expect(screen.queryByText(/Começa nesta semana/)).not.toBeInTheDocument()
      expect(screen.getByText(/^Seg · /)).toBeInTheDocument()
    })

    it('does not show the line when the plan starts this week', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-10-05T12:00:00-03:00')) // Monday
      const { user } = setup()
      await walkWithDays(user, ['Seg', 'Ter'])

      expect(screen.queryByText(/Começa na segunda/)).not.toBeInTheDocument()
    })
  })
})
