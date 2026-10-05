export const SESSION_ID = /^[A-Za-z0-9-]{8,40}$/

export function isValidSessionId(value: unknown): value is string {
  return typeof value === 'string' && SESSION_ID.test(value)
}
