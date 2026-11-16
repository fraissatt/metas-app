import { describe, expect, it } from 'vitest'
import { objectiveMoment, weekMoment } from './moments'

const goal = (id: string, done: boolean[], title = `Meta ${id}`) => ({
  id,
  title,
  dailyTasks: done.map((completed) => ({ completed })),
})

describe('weekMoment', () => {
  it('is quiet when no goal was closed by the change', () => {
    expect(weekMoment([goal('a', [false, false])], [goal('a', [true, false])])).toBeNull()
  })

  it('is quiet for a goal that was already closed (reload, unrelated tick, untick)', () => {
    const before = [goal('a', [true]), goal('b', [false, false])]
    expect(weekMoment(before, [goal('a', [true]), goal('b', [true, false])])).toBeNull()
    expect(weekMoment([goal('a', [true])], [goal('a', [false])])).toBeNull()
  })

  it('names the goal that was just closed while others are still open', () => {
    const before = [goal('a', [true, false], 'Treinar 3x'), goal('b', [false])]
    const after = [goal('a', [true, true], 'Treinar 3x'), goal('b', [false])]
    expect(weekMoment(before, after)).toEqual({
      title: 'Meta da semana fechada',
      body: '“Treinar 3x” está cumprida. Um passo de cada vez.',
    })
  })

  it('celebrates the week, not the goal, when the last open goal closes', () => {
    const before = [goal('a', [true]), goal('b', [true, false])]
    const after = [goal('a', [true]), goal('b', [true, true])]
    expect(weekMoment(before, after)).toEqual({
      title: 'Semana fechada',
      body: 'As 2 metas desta semana estão cumpridas. Descanse sem culpa.',
    })
  })

  it('uses the singular for a week with one goal, and ignores goals without tasks', () => {
    const before = [goal('a', [false]), goal('empty', [])]
    const after = [goal('a', [true]), goal('empty', [])]
    expect(weekMoment(before, after)?.body).toBe('Sua meta desta semana está cumprida. Descanse sem culpa.')
  })

  it('is quiet for a goal that was not there before (a new week arriving)', () => {
    expect(weekMoment([], [goal('a', [true])])).toBeNull()
  })
})

describe('objectiveMoment', () => {
  it('names the objective when it knows it', () => {
    expect(objectiveMoment('Correr 10 km').body).toBe('Você chegou em “Correr 10 km”. Ele fica guardado em Concluídos.')
    expect(objectiveMoment().title).toBe('Objetivo concluído')
  })
})
