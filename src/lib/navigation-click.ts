/** The parts of `window.location` the check needs. */
type Here = { origin: string; pathname: string; search: string }

/**
 * Whether a click will make the app load another page in this tab: a plain
 * left click on a same-origin link to a different path or query. New tabs,
 * downloads, modified clicks and links to an anchor on this page don't count.
 */
export function isNavigationClick(
  event: Pick<MouseEvent, 'button' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'defaultPrevented' | 'target'>,
  here: Here,
): boolean {
  if (event.defaultPrevented || event.button !== 0) return false
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false

  const target = event.target as Element | null
  const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null
  if (!anchor) return false
  if (anchor.target && anchor.target !== '_self') return false
  if (anchor.hasAttribute('download')) return false

  let url: URL
  try {
    url = new URL(anchor.getAttribute('href') ?? '', `${here.origin}${here.pathname}${here.search}`)
  } catch {
    return false
  }
  if (url.origin !== here.origin) return false
  return url.pathname !== here.pathname || url.search !== here.search
}
