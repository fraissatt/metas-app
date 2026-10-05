export const SESSION_ID = /^[A-Za-z0-9-]{8,40}$/

export function isValidSessionId(value: unknown): value is string {
  return typeof value === 'string' && SESSION_ID.test(value)
}

// crypto.randomUUID only exists in secure contexts (https or localhost), so
// opening the app over http://LAN-IP on a phone has to degrade, not crash.
// Every branch yields something that passes SESSION_ID.
export function newSessionId(): string {
  const c = globalThis.crypto
  const uuid = c?.randomUUID?.()
  if (uuid) return uuid
  if (typeof c?.getRandomValues === 'function') {
    const bytes = c.getRandomValues(new Uint8Array(16))
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  }
  return (Date.now().toString(36) + Math.random().toString(36).slice(2)).padEnd(8, '0').slice(0, 40)
}
