import { describe, expect, it } from 'vitest'
import { isNavigationClick } from './navigation-click'

const here = { origin: 'http://localhost', pathname: '/objectives', search: '' }

function linkClick(attrs: Record<string, string>, event: Partial<MouseEvent> = {}) {
  const a = document.createElement('a')
  for (const [name, value] of Object.entries(attrs)) a.setAttribute(name, value)
  const span = document.createElement('span')
  a.appendChild(span)
  return {
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    defaultPrevented: false,
    target: span,
    ...event,
  } as MouseEvent
}

describe('isNavigationClick', () => {
  it('counts a plain click on a link to another page', () => {
    expect(isNavigationClick(linkClick({ href: '/' }), here)).toBe(true)
    expect(isNavigationClick(linkClick({ href: '/objectives/abc' }), here)).toBe(true)
  })

  it('counts a change of query on the same path', () => {
    expect(isNavigationClick(linkClick({ href: '/objectives?nova-meta=1' }), here)).toBe(true)
  })

  it('ignores links to the page already open or to an anchor on it', () => {
    expect(isNavigationClick(linkClick({ href: '/objectives' }), here)).toBe(false)
    expect(isNavigationClick(linkClick({ href: '#conteudo' }), here)).toBe(false)
  })

  it('ignores new tabs, downloads, other sites and modified clicks', () => {
    expect(isNavigationClick(linkClick({ href: '/', target: '_blank' }), here)).toBe(false)
    expect(isNavigationClick(linkClick({ href: '/x.csv', download: '' }), here)).toBe(false)
    expect(isNavigationClick(linkClick({ href: 'https://example.com/' }), here)).toBe(false)
    expect(isNavigationClick(linkClick({ href: '/' }, { ctrlKey: true }), here)).toBe(false)
    expect(isNavigationClick(linkClick({ href: '/' }, { button: 1 }), here)).toBe(false)
    expect(isNavigationClick(linkClick({ href: '/' }, { defaultPrevented: true }), here)).toBe(false)
  })

  it('ignores clicks outside links', () => {
    const event = linkClick({ href: '/' })
    expect(isNavigationClick({ ...event, target: document.createElement('button') }, here)).toBe(false)
  })
})
