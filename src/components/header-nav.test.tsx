import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import { HeaderNav } from '@/components/header-nav'

vi.mock('next/navigation', () => ({ usePathname: vi.fn() }))

describe('HeaderNav', () => {
  it.each([
    ['/', 'Hoje'],
    ['/objectives', 'Objetivos'],
    ['/objectives/1/weeks/2', 'Objetivos'],
  ])('on %s marks %s as the current page', (path, active) => {
    vi.mocked(usePathname).mockReturnValue(path)
    render(<HeaderNav />)

    expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: active })).toHaveAttribute('aria-current', 'page')
    const other = active === 'Hoje' ? 'Objetivos' : 'Hoje'
    expect(screen.getByRole('link', { name: other })).not.toHaveAttribute('aria-current')
  })
})
