import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}))

describe('Sidebar', () => {
  const onThemeChange = vi.fn().mockResolvedValue(undefined)

  it('renders links to Hoje and Objetivos, and no longer a Semana link', () => {
    vi.mocked(usePathname).mockReturnValue('/')
    render(<Sidebar theme="dark" onThemeChange={onThemeChange} />)

    expect(screen.getByRole('link', { name: /hoje/i })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: /objetivos/i })).toHaveAttribute('href', '/objectives')
    expect(screen.queryByRole('link', { name: /semana/i })).not.toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })

  it('marks the link matching the current route as active', () => {
    vi.mocked(usePathname).mockReturnValue('/objectives')
    render(<Sidebar theme="dark" onThemeChange={onThemeChange} />)

    expect(screen.getByRole('link', { name: /objetivos/i })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /hoje/i })).not.toHaveAttribute('aria-current')
  })

  it('marks Objetivos as active for nested objective routes', () => {
    vi.mocked(usePathname).mockReturnValue('/objectives/123/weeks/456')
    render(<Sidebar theme="dark" onThemeChange={onThemeChange} />)

    expect(screen.getByRole('link', { name: /objetivos/i })).toHaveAttribute('aria-current', 'page')
  })

  it('does not mark Objetivos active on the home route', () => {
    vi.mocked(usePathname).mockReturnValue('/')
    render(<Sidebar theme="dark" onThemeChange={onThemeChange} />)

    expect(screen.getByRole('link', { name: /objetivos/i })).not.toHaveAttribute('aria-current')
  })

  it('provides accessible names for mobile navigation links', () => {
    vi.mocked(usePathname).mockReturnValue('/')
    render(<Sidebar theme="dark" onThemeChange={onThemeChange} />)

    expect(screen.getByRole('link', { name: 'Hoje' })).toHaveAttribute('aria-label', 'Hoje')
    expect(screen.getByRole('link', { name: 'Objetivos' })).toHaveAttribute('aria-label', 'Objetivos')
  })

  it('does not match routes with shared prefixes (path boundary safety)', () => {
    vi.mocked(usePathname).mockReturnValue('/objectives-archive')
    render(<Sidebar theme="dark" onThemeChange={onThemeChange} />)

    expect(screen.getByRole('link', { name: /objetivos/i })).not.toHaveAttribute('aria-current')
  })

  it('includes the theme toggle alongside the navigation links', () => {
    vi.mocked(usePathname).mockReturnValue('/')
    render(<Sidebar theme="light" onThemeChange={onThemeChange} />)

    expect(screen.getByRole('button', { name: 'Ativar tema escuro' })).toBeInTheDocument()
  })
})
