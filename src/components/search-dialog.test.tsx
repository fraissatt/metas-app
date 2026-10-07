import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchDialog } from '@/components/search-dialog'
import type { SearchResults } from '@/lib/search'
import { parseDay } from '@/lib/dates'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

const results: SearchResults = {
  objectives: [{ id: 'o1', title: 'Correr uma maratona', completed: false }],
  weeklyGoals: [
    { id: 'w1', title: 'Corrida longa', objectiveId: 'o1', objectiveTitle: 'Correr uma maratona', weekStart: parseDay('2026-09-28') },
  ],
}

afterEach(() => push.mockClear())

async function openWithShortcut() {
  await userEvent.keyboard('{Control>}k{/Control}')
  return screen.findByRole('combobox')
}

describe('SearchDialog', () => {
  it('opens with Ctrl+K and closes again with Ctrl+K', async () => {
    render(<SearchDialog onSearch={vi.fn()} />)

    await openWithShortcut()
    await userEvent.keyboard('{Control>}k{/Control}')

    await waitFor(() => expect(screen.queryByRole('combobox')).not.toBeInTheDocument())
  })

  it('opens from a trigger button', async () => {
    render(<SearchDialog onSearch={vi.fn()} />)
    await userEvent.click(screen.getAllByRole('button', { name: /buscar/i })[0])
    expect(await screen.findByRole('combobox')).toHaveFocus()
  })

  it('does not type a "k" into a focused field when the shortcut is used', async () => {
    render(
      <>
        <input aria-label="campo" />
        <SearchDialog onSearch={vi.fn()} />
      </>,
    )
    await userEvent.click(screen.getByLabelText('campo'))
    await userEvent.keyboard('{Control>}k{/Control}')
    expect(screen.getByLabelText('campo')).toHaveValue('')
    expect(await screen.findByRole('combobox')).toBeInTheDocument()
  })

  it('ignores Ctrl+Shift+K, Ctrl+Alt+K and held-down repeats', async () => {
    render(<SearchDialog onSearch={vi.fn()} />)

    fireEvent.keyDown(window, { key: 'K', ctrlKey: true, shiftKey: true })
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true, altKey: true })
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true, repeat: true })
    await new Promise((r) => setTimeout(r, 50))

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('prevents the browser default for Ctrl+K and Cmd+K', async () => {
    render(<SearchDialog onSearch={vi.fn()} />)

    // fireEvent returns false when preventDefault() was called.
    expect(fireEvent.keyDown(window, { key: 'k', ctrlKey: true })).toBe(false)
    expect(await screen.findByRole('combobox')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    await waitFor(() => expect(screen.queryByRole('combobox')).not.toBeInTheDocument())

    expect(fireEvent.keyDown(window, { key: 'k', metaKey: true })).toBe(false)
    expect(await screen.findByRole('combobox')).toBeInTheDocument()
  })

  it('asks for at least 2 letters before searching', async () => {
    const onSearch = vi.fn()
    render(<SearchDialog onSearch={onSearch} />)
    const input = await openWithShortcut()

    await userEvent.type(input, 'c')
    // Wait past the debounce window so a late call would be caught.
    await new Promise((r) => setTimeout(r, 250))

    expect(screen.getByText('Digite pelo menos 2 letras')).toBeInTheDocument()
    expect(onSearch).not.toHaveBeenCalled()
  })

  it('goes back to the hint when the query drops below 2 letters while a request is pending', async () => {
    const onSearch = vi.fn(() => new Promise<SearchResults>(() => {}))
    render(<SearchDialog onSearch={onSearch} />)
    const input = await openWithShortcut()

    await userEvent.type(input, 'co')
    await waitFor(() => expect(onSearch).toHaveBeenCalledWith('co'))
    await userEvent.keyboard('{Backspace}')

    expect(input).toHaveValue('c')
    expect(screen.getByText('Digite pelo menos 2 letras')).toBeInTheDocument()
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
  })

  it('keeps the last results visible, marked busy, while a newer query is pending', async () => {
    const onSearch = vi.fn((q: string) => (q === 'corr' ? Promise.resolve(results) : new Promise<SearchResults>(() => {})))
    render(<SearchDialog onSearch={onSearch} />)
    const input = await openWithShortcut()
    await userEvent.type(input, 'corr')
    await screen.findByRole('option', { name: /Corrida longa/ })
    expect(screen.getByRole('listbox')).not.toHaveAttribute('aria-busy', 'true')

    await userEvent.type(input, 'e')
    await waitFor(() => expect(onSearch).toHaveBeenCalledWith('corre'))

    expect(screen.getByRole('option', { name: /Correr uma maratona/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Corrida longa/ })).toBeInTheDocument()
    expect(screen.getByRole('listbox')).toHaveAttribute('aria-busy', 'true')
  })

  it('does not show old results when the query drops below 2 letters', async () => {
    const onSearch = vi.fn().mockResolvedValue(results)
    render(<SearchDialog onSearch={onSearch} />)
    const input = await openWithShortcut()
    await userEvent.type(input, 'co')
    await screen.findByRole('option', { name: /Corrida longa/ })

    await userEvent.keyboard('{Backspace}')

    expect(screen.queryByRole('option')).not.toBeInTheDocument()
    expect(screen.getByText('Digite pelo menos 2 letras')).toBeInTheDocument()
  })

  it('resets the query and results when Ctrl+K closes and reopens the dialog', async () => {
    render(<SearchDialog onSearch={vi.fn().mockResolvedValue(results)} />)
    const input = await openWithShortcut()
    await userEvent.type(input, 'corr')
    await screen.findByRole('option', { name: /Corrida longa/ })

    await userEvent.keyboard('{Control>}k{/Control}')
    await waitFor(() => expect(screen.queryByRole('combobox')).not.toBeInTheDocument())
    const reopened = await openWithShortcut()

    expect(reopened).toHaveValue('')
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
  })

  it('searches once after typing stops and shows both groups', async () => {
    const onSearch = vi.fn().mockResolvedValue(results)
    render(<SearchDialog onSearch={onSearch} />)
    const input = await openWithShortcut()

    await userEvent.type(input, 'corr')

    expect(await screen.findByRole('option', { name: /Correr uma maratona/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Corrida longa/ })).toHaveTextContent('Correr uma maratona · semana de 28/09')
    expect(screen.getByText('Objetivos')).toBeInTheDocument()
    expect(screen.getByText('Metas da semana')).toBeInTheDocument()
    expect(onSearch).toHaveBeenCalledTimes(1)
    expect(onSearch).toHaveBeenCalledWith('corr')
  })

  it('says when nothing matches', async () => {
    render(<SearchDialog onSearch={vi.fn().mockResolvedValue({ objectives: [], weeklyGoals: [] })} />)
    const input = await openWithShortcut()

    await userEvent.type(input, 'xyz')

    expect(await screen.findByText('Nada encontrado para “xyz”')).toBeInTheDocument()
  })

  it('opens the highlighted result with the keyboard and closes', async () => {
    render(<SearchDialog onSearch={vi.fn().mockResolvedValue(results)} />)
    const input = await openWithShortcut()
    await userEvent.type(input, 'corr')
    await screen.findByRole('option', { name: /Corrida longa/ })

    await userEvent.keyboard('{ArrowDown}{Enter}')

    expect(push).toHaveBeenCalledWith('/objectives/o1/weeks/w1')
    await waitFor(() => expect(screen.queryByRole('combobox')).not.toBeInTheDocument())
  })

  it('ignores a slow earlier response that arrives after a newer one', async () => {
    let resolveEarly!: (r: SearchResults) => void
    const onSearch = vi.fn((q: string) =>
      q === 'co'
        ? new Promise<SearchResults>((resolve) => (resolveEarly = resolve))
        : Promise.resolve(results),
    )
    render(<SearchDialog onSearch={onSearch} />)
    const input = await openWithShortcut()

    await userEvent.type(input, 'co')
    await waitFor(() => expect(onSearch).toHaveBeenCalledWith('co'))
    await userEvent.type(input, 'r')
    await screen.findByRole('option', { name: /Correr uma maratona/ })

    resolveEarly({ objectives: [{ id: 'old', title: 'Coisa velha', completed: false }], weeklyGoals: [] })

    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByText('Coisa velha')).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Correr uma maratona/ })).toBeInTheDocument()
  })

  it('shows an error message when the search fails', async () => {
    render(<SearchDialog onSearch={vi.fn().mockRejectedValue(new Error('down'))} />)
    const input = await openWithShortcut()

    await userEvent.type(input, 'corr')

    expect(await screen.findByText('Não foi possível buscar agora.')).toBeInTheDocument()
  })
})
