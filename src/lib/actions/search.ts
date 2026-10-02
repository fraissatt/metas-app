'use server'

import { prisma } from '@/lib/db'
import { EMPTY_RESULTS, MAX_RESULTS_PER_GROUP, normalizeQuery, type SearchResults } from '@/lib/search'

// Server Actions are public endpoints: the query is re-normalised here, and
// only ever reaches Postgres as a bound parameter through Prisma.
export async function search(query: string): Promise<SearchResults> {
  const q = normalizeQuery(typeof query === 'string' ? query : '')
  if (!q) return EMPTY_RESULTS

  const title = { contains: q, mode: 'insensitive' as const }
  const [objectives, weeklyGoals] = await Promise.all([
    prisma.objective.findMany({
      where: { title },
      // 'ACTIVE' sorts before 'COMPLETED' alphabetically.
      orderBy: [{ status: 'asc' }, { title: 'asc' }],
      take: MAX_RESULTS_PER_GROUP,
      select: { id: true, title: true, status: true },
    }),
    prisma.weeklyGoal.findMany({
      where: { title },
      orderBy: { weekStart: 'desc' },
      take: MAX_RESULTS_PER_GROUP,
      select: { id: true, title: true, objectiveId: true, weekStart: true, objective: { select: { title: true } } },
    }),
  ])

  return {
    objectives: objectives.map((o) => ({ id: o.id, title: o.title, completed: o.status === 'COMPLETED' })),
    weeklyGoals: weeklyGoals.map((g) => ({
      id: g.id,
      title: g.title,
      objectiveId: g.objectiveId,
      objectiveTitle: g.objective.title,
      weekStart: g.weekStart,
    })),
  }
}
