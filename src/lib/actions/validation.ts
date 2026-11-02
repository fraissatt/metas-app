import { parseDay } from '@/lib/dates'
import { MAX_DESCRIPTION_LENGTH, MAX_TITLE_LENGTH } from '@/lib/limits'

// Server Actions are effectively public endpoints — the HTML `required` /
// `type="date"` / `maxLength` attributes on our forms only constrain
// well-behaved browsers, not a raw fetch/curl POST. Ownership is checked by
// each action (src/lib/owned.ts); this file rejects empty or oversized text
// and unparseable dates before they ever reach Prisma.

export { MAX_DESCRIPTION_LENGTH, MAX_TITLE_LENGTH }

/** Reads and trims a required title field, throwing if it's empty or too long. */
export function readTitle(formData: FormData, field = 'title'): string {
  const title = String(formData.get(field) ?? '').trim()
  if (!title) {
    throw new Error(`"${field}" is required`)
  }
  if (title.length > MAX_TITLE_LENGTH) {
    throw new RangeError(`"${field}" is too long`)
  }
  return title
}

/** Reads an optional free-text field: null when blank, throws when over `max`. */
export function readOptionalText(formData: FormData, field: string, max: number): string | null {
  const raw = formData.get(field)
  const text = raw === null ? '' : String(raw)
  if (!text.trim()) return null
  if (text.length > max) {
    throw new RangeError(`"${field}" is too long`)
  }
  return text
}

// A form day means that day in Brasília, whatever time zone the server runs in.
function safeParseDay(raw: string): Date | null {
  try {
    return parseDay(raw)
  } catch {
    return null
  }
}

/** Reads a required date-only (`yyyy-MM-dd`) field, throwing if unparseable. */
export function readDate(formData: FormData, field: string): Date {
  const raw = String(formData.get(field) ?? '').trim()
  const date = raw ? safeParseDay(raw) : null

  if (!date) {
    throw new Error(`"${field}" must be a valid date`)
  }
  return date
}

/** Reads an optional date-only (`yyyy-MM-dd`) field; throws only if present but unparseable. */
export function readOptionalDate(formData: FormData, field: string): Date | null {
  const raw = formData.get(field)
  const str = raw ? String(raw).trim() : ''
  if (!str) return null

  const date = safeParseDay(str)
  if (!date) {
    throw new Error(`"${field}" must be a valid date`)
  }
  return date
}

/**
 * Reads a checkbox field. An unchecked checkbox submits nothing at all, so
 * presence is the signal — the submitted value ("on", or whatever `value` the
 * control carries) is irrelevant.
 */
export function readCheckbox(formData: FormData, field: string): boolean {
  return formData.get(field) !== null
}
