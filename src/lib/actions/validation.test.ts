import { describe, expect, it } from 'vitest'
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_TITLE_LENGTH,
  readCheckbox,
  readDate,
  readOptionalDate,
  readOptionalText,
  readTitle,
} from '@/lib/actions/validation'
import { formatDayKey } from '@/lib/dates'

function formData(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [key, value] of Object.entries(fields)) fd.set(key, value)
  return fd
}

describe('readTitle', () => {
  it('trims and returns a non-empty title', () => {
    expect(readTitle(formData({ title: '  Correr 5km  ' }))).toBe('Correr 5km')
  })

  it('throws when the title is missing', () => {
    expect(() => readTitle(new FormData())).toThrow()
  })

  it('throws when the title is empty after trimming', () => {
    expect(() => readTitle(formData({ title: '   ' }))).toThrow()
  })

  it('accepts a title at the limit and rejects one over it', () => {
    expect(readTitle(formData({ title: 'a'.repeat(MAX_TITLE_LENGTH) }))).toHaveLength(MAX_TITLE_LENGTH)
    expect(() => readTitle(formData({ title: 'a'.repeat(MAX_TITLE_LENGTH + 1) }))).toThrow('too long')
  })
})

describe('readOptionalText', () => {
  it('returns null when absent or blank', () => {
    expect(readOptionalText(new FormData(), 'description', 10)).toBeNull()
    expect(readOptionalText(formData({ description: '   ' }), 'description', 10)).toBeNull()
  })

  it('returns the text as typed when within the limit', () => {
    expect(readOptionalText(formData({ description: 'Por saúde' }), 'description', MAX_DESCRIPTION_LENGTH)).toBe('Por saúde')
  })

  it('throws when over the limit', () => {
    expect(() =>
      readOptionalText(formData({ description: 'a'.repeat(MAX_DESCRIPTION_LENGTH + 1) }), 'description', MAX_DESCRIPTION_LENGTH),
    ).toThrow('too long')
  })
})

describe('readDate', () => {
  it('parses a valid yyyy-MM-dd string as that day in Brasília', () => {
    const date = readDate(formData({ date: '2026-07-29' }), 'date')
    expect(formatDayKey(date)).toBe('2026-07-29')
  })

  it('throws when the field is missing', () => {
    expect(() => readDate(new FormData(), 'date')).toThrow()
  })

  it('throws when the field is an unparseable string', () => {
    expect(() => readDate(formData({ date: 'not-a-date' }), 'date')).toThrow()
  })
})

describe('readOptionalDate', () => {
  it('returns null when the field is absent', () => {
    expect(readOptionalDate(new FormData(), 'targetDate')).toBeNull()
  })

  it('returns null when the field is an empty string', () => {
    expect(readOptionalDate(formData({ targetDate: '' }), 'targetDate')).toBeNull()
  })

  it('parses a valid yyyy-MM-dd string when present', () => {
    const date = readOptionalDate(formData({ targetDate: '2026-06-30' }), 'targetDate')
    expect(date && formatDayKey(date)).toBe('2026-06-30')
  })

  it('throws when present but unparseable', () => {
    expect(() => readOptionalDate(formData({ targetDate: 'nope' }), 'targetDate')).toThrow()
  })
})

describe('readCheckbox', () => {
  it('is true when the field is present', () => {
    const fd = new FormData()
    fd.set('recurring', 'on')

    expect(readCheckbox(fd, 'recurring')).toBe(true)
  })

  it('is false when the field is absent', () => {
    // An unchecked checkbox submits nothing at all — that absence is the
    // whole signal, which is why this reads presence rather than a value.
    expect(readCheckbox(new FormData(), 'recurring')).toBe(false)
  })
})

describe('form days are Brasília days', () => {
  it('reads a form day as 00:00 in Brasília, whatever the server time zone', () => {
    expect(readDate(formData({ date: '2026-10-05' }), 'date').toISOString()).toBe('2026-10-05T03:00:00.000Z')
    expect(readOptionalDate(formData({ d: '2026-10-05' }), 'd')?.toISOString()).toBe('2026-10-05T03:00:00.000Z')
  })
})
