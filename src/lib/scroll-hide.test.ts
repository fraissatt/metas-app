import { describe, expect, it } from 'vitest'
import { HIDE_AFTER, MIN_MOVE, nextScrollState } from '@/lib/scroll-hide'

const shown = (lastY: number) => ({ hidden: false, lastY })
const hidden = (lastY: number) => ({ hidden: true, lastY })

describe('nextScrollState', () => {
  it('stays shown at the top and until the page has scrolled past the threshold', () => {
    expect(nextScrollState(shown(0), 0, false)).toEqual(shown(0))
    expect(nextScrollState(shown(0), HIDE_AFTER, false).hidden).toBe(false)
  })

  it('hides when moving down past the threshold', () => {
    expect(nextScrollState(shown(70), HIDE_AFTER + 20, false)).toEqual(hidden(HIDE_AFTER + 20))
  })

  it('shows again when moving up', () => {
    expect(nextScrollState(hidden(400), 380, false)).toEqual(shown(380))
  })

  it('shows again back at the top, however it got there', () => {
    expect(nextScrollState(hidden(40), 0, false)).toEqual(shown(0))
  })

  it('ignores moves of MIN_MOVE or less and keeps the reference point, so small moves add up', () => {
    const start = hidden(300)
    expect(nextScrollState(start, 300 - MIN_MOVE, false)).toEqual(start)
    expect(nextScrollState(start, 300 + MIN_MOVE, false)).toEqual(start)
    // Small steps up from 300 do not flip it one by one, but they add up past the limit.
    let state = start
    for (const y of [297, 294]) state = nextScrollState(state, y, false)
    expect(state.hidden).toBe(true)
    expect(nextScrollState(state, 292, false).hidden).toBe(false)
  })

  it('never hides while pinned, and shows if it was hidden', () => {
    expect(nextScrollState(shown(100), 500, true)).toEqual(shown(500))
    expect(nextScrollState(hidden(500), 600, true)).toEqual(shown(600))
  })
})
