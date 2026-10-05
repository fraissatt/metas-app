import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { getFunnelStats, trackFunnelEvent } from '@/lib/actions/funnel'

const SID = 'session-0001'

describe('trackFunnelEvent', () => {
  it('stores a valid step_viewed event', async () => {
    await trackFunnelEvent({ sessionId: SID, type: 'step_viewed', step: 'area' })
    const rows = await prisma.funnelEvent.findMany()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ sessionId: SID, type: 'step_viewed', step: 'area', value: null })
  })

  it('truncates a value longer than 100 characters', async () => {
    await trackFunnelEvent({ sessionId: SID, type: 'step_answered', step: 'area', value: 'x'.repeat(150) })
    const [row] = await prisma.funnelEvent.findMany()
    expect(row.value).toBe('x'.repeat(100))
  })

  it.each([
    ['unknown type', { sessionId: SID, type: 'hack' }],
    ['step_answered without a step', { sessionId: SID, type: 'step_answered' }],
    ['unknown step id', { sessionId: SID, type: 'step_viewed', step: 'nope' }],
    ['empty sessionId', { sessionId: '', type: 'quiz_started' }],
    ['sessionId over 40 chars', { sessionId: 'a'.repeat(41), type: 'quiz_started' }],
    ['sessionId with spaces', { sessionId: 'has some spaces', type: 'quiz_started' }],
  ])('drops %s silently', async (_name, event) => {
    await expect(trackFunnelEvent(event as never)).resolves.toBeUndefined()
    expect(await prisma.funnelEvent.count()).toBe(0)
  })
})

type Row = { sessionId: string; type: string; step: string | null; value: string | null; createdAt: Date }

function run(sessionId: string, base: number) {
  const rows: Row[] = []
  const ev = (type: string, off: number, step?: string, value?: string) => {
    rows.push({ sessionId, type, step: step ?? null, value: value ?? null, createdAt: new Date(base + off * 1000) })
  }
  return { rows, ev }
}

describe('getFunnelStats', () => {
  it('returns zeros for an empty database', async () => {
    const stats = await getFunnelStats()
    expect(stats.starts).toBe(0)
    expect(stats.conversion).toBeNull()
    expect(stats.medianSecondsToPlan).toBeNull()
    expect(stats.biggestDrop).toBeNull()
    expect(stats.recent).toEqual([])
    expect(stats.stages.map((s) => s.sessions)).toEqual([0, 0, 0, 0, 0, 0, 0])
    expect(stats.stages.map((s) => s.label)).toEqual([
      'Área', 'Foco', 'Prazo', 'Dias', 'Obstáculo', 'Resultado', 'Plano criado',
    ])
  })

  it('computes the funnel from a seeded scenario', async () => {
    const t = Date.parse('2026-10-05T10:00:00Z')

    // A: completes and creates the plan 150 seconds after starting
    const a = run('sess-AAAAAAAA', t)
    a.ev('quiz_started', 0)
    a.ev('step_viewed', 1, 'area'); a.ev('step_answered', 2, 'area', 'saude')
    a.ev('step_viewed', 3, 'foco'); a.ev('step_answered', 4, 'foco', 'correr')
    a.ev('step_viewed', 5, 'prazo'); a.ev('step_answered', 6, 'prazo', '3')
    a.ev('step_viewed', 7, 'dias'); a.ev('step_answered', 8, 'dias', 'seg,qua')
    a.ev('step_viewed', 9, 'obstaculo'); a.ev('step_answered', 10, 'obstaculo', 'tempo')
    a.ev('result_viewed', 11)
    a.ev('plan_created', 150)

    // B: stops after viewing dias
    const b = run('sess-BBBBBBBB', t + 1000_000)
    b.ev('quiz_started', 0)
    b.ev('step_viewed', 1, 'area'); b.ev('step_answered', 2, 'area', 'saude')
    b.ev('step_viewed', 3, 'foco'); b.ev('step_answered', 4, 'foco', 'sono')
    b.ev('step_viewed', 5, 'prazo'); b.ev('step_answered', 6, 'prazo', '3')
    b.ev('step_viewed', 7, 'dias')

    // C: stops after viewing area
    const c = run('sess-CCCCCCCC', t + 2000_000)
    c.ev('quiz_started', 0)
    c.ev('step_viewed', 1, 'area')

    // D: reaches the result and goes back once, so prazo is viewed twice
    const d = run('sess-DDDDDDDD', t + 3000_000)
    d.ev('quiz_started', 0)
    d.ev('step_viewed', 1, 'area'); d.ev('step_answered', 2, 'area', 'estudos')
    d.ev('step_viewed', 3, 'foco'); d.ev('step_answered', 4, 'foco', 'leitura')
    d.ev('step_viewed', 5, 'prazo'); d.ev('step_answered', 6, 'prazo', '6')
    d.ev('step_viewed', 7, 'dias'); d.ev('step_answered', 8, 'dias', 'sab')
    d.ev('step_viewed', 9, 'obstaculo'); d.ev('step_answered', 10, 'obstaculo', 'tempo')
    d.ev('result_viewed', 11)
    d.ev('step_viewed', 12, 'prazo')

    await prisma.funnelEvent.createMany({ data: [...a.rows, ...b.rows, ...c.rows, ...d.rows] })

    const stats = await getFunnelStats()
    expect(stats.starts).toBe(4)
    expect(stats.stages.map((s) => [s.id, s.sessions])).toEqual([
      ['area', 4], ['foco', 3], ['prazo', 3], ['dias', 3], ['obstaculo', 2], ['result', 2], ['plan', 1],
    ])
    expect(stats.stages.map((s) => s.percentOfStart)).toEqual([100, 75, 75, 75, 50, 50, 25])
    expect(stats.stages.map((s) => s.dropFromPrevious)).toEqual([null, 25, 0, 0, 33, 0, 50])
    expect(stats.conversion).toBe(25)
    expect(stats.biggestDrop?.id).toBe('plan')
    expect(stats.medianSecondsToPlan).toBe(150)

    const byStep = Object.fromEntries(stats.answers.map((x) => [x.step, x]))
    const dias = Object.fromEntries(byStep.dias.options.map((o) => [o.label, o.count]))
    expect(dias).toMatchObject({ Seg: 1, Qua: 1, 'Sáb': 1 })
    expect(byStep.area.options.find((o) => o.value === 'saude')).toMatchObject({
      label: 'Saúde e corpo', count: 2, share: 67,
    })

    expect(stats.recent.map((r) => r.sessionId)).toEqual([
      'sess-DDDDDDDD', 'sess-CCCCCCCC', 'sess-BBBBBBBB', 'sess-AAAAAAAA',
    ])
    expect(stats.recent[3]).toMatchObject({ created: true, furthest: 'Plano criado' })
    expect(stats.recent[1]).toMatchObject({ created: false, furthest: 'Área' })
  })

  it('limits recent runs to 10, newest first', async () => {
    const base = Date.parse('2026-10-05T10:00:00Z')
    await prisma.funnelEvent.createMany({
      data: Array.from({ length: 12 }, (_, i) => ({
        sessionId: `session-${String(i).padStart(4, '0')}`,
        type: 'quiz_started',
        createdAt: new Date(base + i * 1000),
      })),
    })
    const stats = await getFunnelStats()
    expect(stats.recent).toHaveLength(10)
    expect(stats.recent[0].sessionId).toBe('session-0011')
  })
})
