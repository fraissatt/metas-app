import { describe, expect, it } from 'vitest'
import { readCheckbox, readDate, readOptionalDate, readTitle } from '@/lib/actions/validation'

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
})

describe('readDate', () => {
  it('parses a valid yyyy-MM-dd string as a local date', () => {
    const date = readDate(formData({ date: '2026-07-29' }), 'date')
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(6)
    expect(date.getDate()).toBe(29)
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
    expect(date?.getDate()).toBe(30)
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
