'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import type { Objective } from '@prisma/client'

function readObjectiveFields(formData: FormData) {
  const title = String(formData.get('title') ?? '').trim()
  const description = formData.get('description')
  const startDate = String(formData.get('startDate') ?? '')
  const targetDate = formData.get('targetDate')

  return {
    title,
    description: description ? String(description) : null,
    startDate: new Date(startDate),
    targetDate: targetDate ? new Date(String(targetDate)) : null,
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
