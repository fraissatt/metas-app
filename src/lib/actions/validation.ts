import { parseISO } from 'date-fns'

// Server Actions are effectively public endpoints — the HTML `required` /
// `type="date"` attributes on our forms only constrain well-behaved
// browsers, not a raw fetch/curl POST. Keep this minimal (no auth or
// permissions layer exists in this MVP): just reject empty titles and
// unparseable dates before they ever reach Prisma, instead of letting
// `Invalid Date` or blank strings become an unhandled Prisma error.

/** Reads and trims a required title field, throwing if it's empty. */
export function readTitle(formData: FormData, field = 'title'): string {
  const title = String(formData.get(field) ?? '').trim()
  if (!title) {
    throw new Error(`"${field}" is required`)
  }
  return title
}

/** Reads a required date-only (`yyyy-MM-dd`) field, throwing if unparseable. */
export function readDate(formData: FormData, field: string): Date {
  const raw = String(formData.get(field) ?? '').trim()
  const date = raw ? parseISO(raw) : null

  if (!date || Number.isNaN(date.getTime())) {
    throw new Error(`"${field}" must be a valid date`)
  }
  return date
}

/** Reads an optional date-only (`yyyy-MM-dd`) field; throws only if present but unparseable. */
export function readOptionalDate(formData: FormData, field: string): Date | null {
  const raw = formData.get(field)
  const str = raw ? String(raw).trim() : ''
  if (!str) return null

  const date = parseISO(str)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`"${field}" must be a valid date`)
  }
  return date
}
