'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { readDate, readOptionalDate, readTitle } from '@/lib/actions/validation'
import type { Objective } from '@prisma/client'

function readObjectiveFields(formData: FormData) {
  const title = readTitle(formData)
  const description = formData.get('description')

  return {
    title,
    description: description ? String(description) : null,
    startDate: readDate(formData, 'startDate'),
    targetDate: readOptionalDate(formData, 'targetDate'),
  }
}

export async function createObjective(formData: FormData): Promise<void> {
  await prisma.objective.create({ data: readObjectiveFields(formData) })
  revalidatePath('/objectives')
}

export async function listObjectives(): Promise<Objective[]> {
  return prisma.objective.findMany({ orderBy: { createdAt: 'desc' } })
}

export async function getObjective(id: string): Promise<Objective | null> {
  return prisma.objective.findUnique({ where: { id } })
}

export async function updateObjective(id: string, formData: FormData): Promise<void> {
  await prisma.objective.update({ where: { id }, data: readObjectiveFields(formData) })
  revalidatePath('/objectives')
}

export async function deleteObjective(id: string): Promise<void> {
  await prisma.objective.delete({ where: { id } })
  revalidatePath('/objectives')
}
