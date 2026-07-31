import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}))

describe('Sidebar', () => {
  it('renders links to Hoje, Semana and Objetivos', () => {
    vi.mocked(usePathname).mockReturnValue('/')
    render(<Sidebar />)

    expect(screen.getByRole('link', { name: /hoje/i })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: /semana/i })).toHaveAttribute('href', '/week')
    expect(screen.getByRole('link', { name: /objetivos/i })).toHaveAttribute('href', '/objectives')
  })

  it('marks the link matching the current route as active', () => {
    vi.mocked(usePathname).mockReturnValue('/week')
    render(<Sidebar />)

    expect(screen.getByRole('link', { name: /semana/i })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /hoje/i })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: /objetivos/i })).not.toHaveAttribute('aria-current')
  })

  it('marks Objetivos as active for nested objective routes', () => {
    vi.mocked(usePathname).mockReturnValue('/objectives/123/weeks/456')
    render(<Sidebar />)

    expect(screen.getByRole('link', { name: /objetivos/i })).toHaveAttribute('aria-current', 'page')
  })

  it('does not mark Objetivos active on the home route', () => {
    vi.mocked(usePathname).mockReturnValue('/')
    render(<Sidebar />)

    expect(screen.getByRole('link', { name: /objetivos/i })).not.toHaveAttribute('aria-current')
  })
})
