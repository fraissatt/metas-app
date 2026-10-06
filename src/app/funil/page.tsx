import type { Metadata } from 'next'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { getFunnelStats } from '@/lib/actions/funnel'
import { isFunnelPublic } from '@/lib/public-routes'
import { requireUser } from '@/lib/session'
import { FunnelChart } from '@/components/funnel-chart'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = { title: 'Funil do quiz' }
export const dynamic = 'force-dynamic'

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xl md:text-2xl font-bold tabular-nums text-accent-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function formatMinutesSeconds(totalSeconds: number | null): string {
  if (totalSeconds === null) return '—'
  const rounded = Math.round(totalSeconds)
  const seconds = String(rounded % 60).padStart(2, '0')
  return `${Math.floor(rounded / 60)}:${seconds}`
}

export default async function FunnelPage() {
  if (!isFunnelPublic()) await requireUser()
  const stats = await getFunnelStats()

  if (stats.starts === 0) {
    return (
      <main className="mx-auto max-w-5xl p-4 md:p-8">
        <h1 className="mb-6 text-2xl font-semibold">Funil do quiz</h1>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-muted-foreground">Ninguém passou pelo quiz ainda.</p>
          <Button nativeButton={false} render={<Link href="/quiz" />}>
            Fazer o quiz
          </Button>
        </div>
      </main>
    )
  }

  const { biggestDrop } = stats

  return (
    <main className="mx-auto max-w-5xl p-4 md:p-8">
      <h1 className="mb-6 text-2xl font-semibold">Funil do quiz</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile value={String(stats.starts)} label="passagens" />
        <Tile value={stats.conversion === null ? '—' : `${stats.conversion}%`} label="criaram o plano" />
        <Tile value={formatMinutesSeconds(stats.medianSecondsToPlan)} label="tempo médio até o plano" />
        <Tile
          value={biggestDrop && biggestDrop.dropFromPrevious ? biggestDrop.label : '—'}
          label="abandono maior"
        />
      </div>

      <section className="mt-6 rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-lg font-semibold">Funil</h2>
        <FunnelChart stages={stats.stages} biggestDropId={biggestDrop?.id ?? null} />
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-semibold">Respostas</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {stats.answers.map((step) => (
            <div key={step.step} className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-2 text-sm font-medium">{step.title}</h3>
              {step.options.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem respostas ainda.</p>
              ) : (
                <ul className="space-y-2">
                  {step.options.map((o) => (
                    <li key={o.value}>
                      <div className="flex justify-between text-xs">
                        <span>{o.label}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {o.count} · {o.share}%
                        </span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-muted">
                        <div className="h-2 rounded-full bg-primary" style={{ width: `${o.share}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-lg font-semibold">Últimas passagens</h2>
        <ul className="divide-y divide-border text-sm">
          {stats.recent.map((r) => (
            <li key={r.sessionId} className="flex flex-wrap justify-between gap-2 py-2">
              <span className="text-muted-foreground">
                {formatDistanceToNow(r.startedAt, { addSuffix: true, locale: ptBR })}
              </span>
              <span>{r.created ? 'plano criado' : `parou em ${r.furthest}`}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
