/** The three totals as one quiet sentence. */
export function ObjectivesOverview({
  activeCount,
  weeksFulfilled,
  recentRate,
}: {
  activeCount: number
  weeksFulfilled: number
  recentRate: number | null
}) {
  return (
    <p className="text-sm text-muted-foreground">
      <strong className="font-semibold tabular-nums text-foreground">{activeCount}</strong>{' '}
      {activeCount === 1 ? 'ativo' : 'ativos'} ·{' '}
      <strong className="font-semibold tabular-nums text-foreground">{weeksFulfilled}</strong>{' '}
      {weeksFulfilled === 1 ? 'semana cumprida' : 'semanas cumpridas'} ·{' '}
      <strong className="font-semibold tabular-nums text-foreground">
        {recentRate === null ? '—' : `${recentRate}%`}
      </strong>{' '}
      de média em 8 sem.
    </p>
  )
}
