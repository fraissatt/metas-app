import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { search } from '@/lib/actions/search'
import { getWeekBounds } from '@/lib/dates'

async function objective(title: string, completed = false) {
  return prisma.objective.create({
    data: {
      title,
      startDate: new Date('2026-01-01'),
      status: completed ? 'COMPLETED' : 'ACTIVE',
      completedAt: completed ? new Date('2026-06-01') : null,
    },
  })
}

async function weeklyGoal(title: string, objectiveId: string, day: string) {
  return prisma.weeklyGoal.create({
    data: { title, objectiveId, ...getWeekBounds(new Date(`${day}T12:00:00`)) },
  })
}

describe('search', () => {
  it('matches objective and weekly goal titles ignoring case', async () => {
    const obj = await objective('Correr uma maratona')
    await weeklyGoal('Corrida longa', obj.id, '2026-09-30')
    await objective('Ler 12 livros')

    const results = await search('CORR')

    expect(results.objectives.map((o) => o.title)).toEqual(['Correr uma maratona'])
    expect(results.weeklyGoals).toEqual([
      expect.objectContaining({ title: 'Corrida longa', objectiveId: obj.id, objectiveTitle: 'Correr uma maratona' }),
    ])
  })

  it('returns nothing for queries under 2 characters, without hitting the database', async () => {
    await objective('A meta')
    expect(await search(' a ')).toEqual({ objectives: [], weeklyGoals: [] })
  })

  it('caps each group at 5 results', async () => {
    const obj = await objective('Base 0')
    for (let i = 1; i <= 6; i++) await objective(`Base ${i}`)
    for (let i = 0; i < 6; i++) await weeklyGoal(`Base meta ${i}`, obj.id, `2026-0${i + 1}-15`)

    const results = await search('base')

    expect(results.objectives).toHaveLength(5)
    expect(results.weeklyGoals).toHaveLength(5)
  })

  it('lists active objectives before completed ones, then by title', async () => {
    await objective('Treino B', true)
    await objective('Treino C')
    await objective('Treino A')

    const results = await search('treino')

    expect(results.objectives.map((o) => [o.title, o.completed])).toEqual([
      ['Treino A', false],
      ['Treino C', false],
      ['Treino B', true],
    ])
  })

  it('lists weekly goals newest week first', async () => {
    const obj = await objective('Obj')
    await weeklyGoal('Leitura antiga', obj.id, '2026-03-04')
    await weeklyGoal('Leitura nova', obj.id, '2026-09-30')

    const results = await search('leitura')

    expect(results.weeklyGoals.map((g) => g.title)).toEqual(['Leitura nova', 'Leitura antiga'])
  })
})
