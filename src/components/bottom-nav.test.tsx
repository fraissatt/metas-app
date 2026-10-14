import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import { BottomNav } from '@/components/bottom-nav'

vi.mock('next/navigation', () => ({ usePathname: vi.fn() }))

describe('BottomNav', () => {
  it('shows both destinations with visible labels and marks the active one', () => {
    vi.mocked(usePathname).mockReturnValue('/objectives/9')
    render(<BottomNav />)

    expect(screen.getAllByRole('link')).toHaveLength(2)
    expect(screen.getByText('Hoje')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Hoje' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Objetivos' })).toHaveAttribute('aria-current', 'page')
  })

  it('is a bottom island: floating with a margin, rounded, glass, and gone from md up', () => {
    vi.mocked(usePathname).mockReturnValue('/')
    render(<BottomNav />)
    const nav = screen.getByRole('navigation', { name: 'Navegação principal' })
    const island = nav.parentElement as HTMLElement // the FloatingBar carries the position and the glass
    expect(island).toHaveAttribute('data-edge', 'bottom')
    expect(island.className).toMatch(/(^|\s)island(\s|$)/)
    expect(island.className).toMatch(/md:hidden/)
    expect(island.className).toMatch(/rounded-full/)
    expect(island.className).toMatch(/bottom-\[calc\(0\.75rem/) // floating, with a margin from the edge
  })
})
