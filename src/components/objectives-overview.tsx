function Tile({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xl md:text-2xl font-bold tabular-nums text-accent-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

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
    <div className="grid grid-cols-3 gap-3">
      <Tile value={String(activeCount)} label="objetivos ativos" />
      <Tile value={String(weeksFulfilled)} label="semanas cumpridas" />
      <Tile value={recentRate === null ? '—' : `${recentRate}%`} label="conclusão média (8 sem.)" />
    </div>
  )
}
