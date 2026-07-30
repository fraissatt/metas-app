import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'

describe('prisma test database', () => {
  it('creates and reads an Objective', async () => {
    const objective = await prisma.objective.create({
      data: { title: 'Aprender React', startDate: new Date('2026-01-01') },
    })

    const found = await prisma.objective.findUnique({ where: { id: objective.id } })

    expect(found?.title).toBe('Aprender React')
  })
})
