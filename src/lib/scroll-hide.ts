// The rule behind the floating bars: hide on the way down, show on the way up.
export const HIDE_AFTER = 80
export const MIN_MOVE = 6

export type ScrollState = { hidden: boolean; lastY: number }

/**
 * `lastY` is the scroll position of the last decision: it only moves when the
 * page has moved more than MIN_MOVE from it, so tiny moves add up instead of flickering.
 */
export function nextScrollState(state: ScrollState, y: number, pinned: boolean): ScrollState {
  if (pinned || y <= HIDE_AFTER) return { hidden: false, lastY: y }
  const moved = y - state.lastY
  if (moved > MIN_MOVE) return { hidden: true, lastY: y }
  if (moved < -MIN_MOVE) return { hidden: false, lastY: y }
  return state
}
