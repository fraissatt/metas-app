/**
 * Where the reference line sits along the steps, as a number: 0 at the first
 * step's centre, 1 at the second's, and so on, interpolated in between and
 * clamped at both ends. `centers` are the steps' vertical centres in window
 * coordinates, top to bottom (scrolling down moves them up).
 */
export function scrollProgress(centers: readonly number[], reference: number): number {
  const last = centers.length - 1
  if (last < 0 || reference <= centers[0]) return 0
  if (reference >= centers[last]) return last
  let index = 0
  while (centers[index + 1] <= reference) index++
  return index + (reference - centers[index]) / (centers[index + 1] - centers[index])
}

/**
 * How visible each of `count` stacked views is at `progress`: 1 at its own
 * step, fading linearly to 0 one step away, so neighbours cross-fade. When
 * motion is reduced the views switch at once instead.
 */
export function viewWeights(progress: number, count: number, discrete: boolean): number[] {
  return Array.from({ length: count }, (_, index) => {
    const weight = discrete ? (index === Math.round(progress) ? 1 : 0) : Math.max(0, 1 - Math.abs(progress - index))
    return Math.round(weight * 1000) / 1000
  })
}
