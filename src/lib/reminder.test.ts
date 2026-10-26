import { describe, expect, it } from 'vitest'
import { parseDay } from '@/lib/dates'
import { buildReminder, tasksToDayDone } from '@/lib/reminder'

const task = (completed: boolean) => ({ date: parseDay('2026-10-26'), completed })

describe('tasksToDayDone', () => {
  it('counts what is missing to reach 60% of the day', () => {
    expect(tasksToDayDone([task(false), task(false), task(false)])).toBe(2)
    expect(tasksToDayDone([task(true), task(false), task(false)])).toBe(1)
    expect(tasksToDayDone([task(true), task(true), task(false)])).toBe(0)
    expect(tasksToDayDone([task(false)])).toBe(1)
  })
})

describe('buildReminder', () => {
  it('says how many tasks make today the next done day', () => {
    expect(buildReminder([task(true), task(false), task(false)], 45)).toEqual({
      title: 'Metas',
      body: 'Mais 1 tarefa e hoje vira seu 46º dia feito.',
      url: '/',
    })
    expect(buildReminder([task(false), task(false), task(false)], 0)?.body).toBe(
      'Mais 2 tarefas e hoje vira seu 1º dia feito.',
    )
  })

  it('stays quiet when today has no tasks or is already done', () => {
    expect(buildReminder([], 10)).toBeNull()
    expect(buildReminder([task(true), task(true), task(false)], 10)).toBeNull()
  })
})
