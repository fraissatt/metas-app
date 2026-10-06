'use server'

import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { EMPTY_RESULTS, MAX_RESULTS_PER_GROUP, normalizeQuery, type SearchResults } from '@/lib/search'

// Prisma's `contains` does not escape LIKE wildcards, so "50%" would match
// "50 km". Escape `\`, `%` and `_` (Postgres' default LIKE escape is `\`).
function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, '\\$&')
}

// Server Actions are public endpoints: the query is re-normalised here, and
// only ever reaches Postgres as a bound parameter through Prisma.
export async function search(query: string): Promise<SearchResults> {
  const q = normalizeQuery(typeof query === 'string' ? query : '')
  if (!q) return EMPTY_RESULTS
  const user = await requireUser()

  const title = { contains: escapeLike(q), mode: 'insensitive' as const }
  const [objectives, weeklyGoals] = await Promise.all([
    prisma.objective.findMany({
      where: { title, userId: user.id },
      // Enum order is Postgres' declaration order (ACTIVE, COMPLETED,
      // ABANDONED in prisma/schema.prisma), not alphabetical; `id` makes ties
      // deterministic.
      orderBy: [{ status: 'asc' }, { title: 'asc' }, { id: 'asc' }],
      take: MAX_RESULTS_PER_GROUP,
      select: { id: true, title: true, status: true },
    }),
    prisma.weeklyGoal.findMany({
      where: { title, objective: { userId: user.id } },
      orderBy: [{ weekStart: 'desc' }, { title: 'asc' }, { id: 'asc' }],
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
