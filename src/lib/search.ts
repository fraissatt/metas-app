export const MIN_QUERY_LENGTH = 2
export const MAX_QUERY_LENGTH = 100
export const MAX_RESULTS_PER_GROUP = 5

export type ObjectiveHit = { id: string; title: string; completed: boolean }
export type WeeklyGoalHit = {
  id: string
  title: string
  objectiveId: string
  objectiveTitle: string
  weekStart: Date
}
export type SearchResults = { objectives: ObjectiveHit[]; weeklyGoals: WeeklyGoalHit[] }

export const EMPTY_RESULTS: SearchResults = { objectives: [], weeklyGoals: [] }

export function normalizeQuery(raw: string): string | null {
  const trimmed = raw.trim().slice(0, MAX_QUERY_LENGTH)
  return trimmed.length >= MIN_QUERY_LENGTH ? trimmed : null
}
