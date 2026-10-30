import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Normalised: a Windows checkout has CRLF line endings.
const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8').replace(/\r\n/g, '\n')

const START = '@media (display-mode: window-controls-overlay) {'
const from = css.indexOf(START)
const end = css.indexOf('\n}\n', from)
const block = from === -1 ? '' : css.slice(from, end)

/** The declarations of one rule inside the overlay block, or '' when it is missing. */
function rule(selector: string): string {
  const start = block.indexOf(`\n  ${selector} {`)
  if (start === -1) return ''
  return block.slice(start, block.indexOf('}', start))
}

describe('title bar of the installed app (window-controls-overlay)', () => {
  it('has a block for the overlay media query', () => {
    expect(block).not.toBe('')
  })

  it('turns the header into a flat, fixed bar over the title bar, inside the area the system leaves', () => {
    const bar = rule('[data-app-bar]')
    expect(bar).toContain('position: fixed;')
    expect(bar).toContain('inset: 0 0 auto 0;')
    expect(bar).toContain('height: env(titlebar-area-height, ')
    expect(bar).toContain('padding-left: env(titlebar-area-x, ')
    expect(bar).toContain('padding-right: calc(100% - env(titlebar-area-x, 0px) - env(titlebar-area-width, ')
    expect(bar).toContain('border-radius: 0;')
    expect(bar).toContain('background: var(--background);')
    expect(bar).toContain('backdrop-filter: none;')
    expect(bar).toContain('box-shadow: none;')
  })

  it('drags the window from the empty bar, and leaves links, buttons and fields clickable', () => {
    const bar = rule('[data-app-bar]')
    expect(bar).toContain('-webkit-app-region: drag;')
    expect(bar).toContain('\n    app-region: drag;')

    const interactive = rule('[data-app-bar] :is(a, button, input, select, textarea, [tabindex])')
    expect(interactive).toContain('-webkit-app-region: no-drag;')
    expect(interactive).toContain('\n    app-region: no-drag;')
  })

  it('stretches the content to the bar and keeps the page below it at every width', () => {
    const inner = rule('[data-app-bar-inner]')
    expect(inner).toContain('max-width: none;')
    expect(inner).toContain('height: 100%;')

    const spacer = rule('[data-app-bar-spacer]')
    expect(spacer).toContain('display: block;')
    expect(spacer).toContain('height: calc(env(titlebar-area-height, ')
  })

  it('leaves the floating header alone outside the overlay', () => {
    const outside = css.slice(0, from) + css.slice(end)
    expect(outside).not.toContain('[data-app-bar')
  })
})
