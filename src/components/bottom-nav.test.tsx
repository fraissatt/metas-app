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
})
