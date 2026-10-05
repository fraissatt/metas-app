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
    await trackFunnelEvent({ sessionId: SID, type: 'step_viewed', step: 'area', value: 'x'.repeat(150) })
    const [row] = await prisma.funnelEvent.findMany()
    expect(row.value).toBe('x'.repeat(100))
  })

  it('drops a step_answered whose value is not an option of that step', async () => {
    await trackFunnelEvent({ sessionId: SID, type: 'step_answered', step: 'area', value: 'nope' })
    await trackFunnelEvent({ sessionId: SID, type: 'step_answered', step: 'dias', value: 'seg,xyz' })
    await trackFunnelEvent({ sessionId: SID, type: 'step_answered', step: 'foco', value: 'saude' })
    expect(await prisma.funnelEvent.count()).toBe(0)
  })

  it('accepts valid answers, including any focus and comma-joined days', async () => {
    await trackFunnelEvent({ sessionId: SID, type: 'step_answered', step: 'foco', value: 'idioma' })
    await trackFunnelEvent({ sessionId: SID, type: 'step_answered', step: 'dias', value: 'seg,qua' })
    await trackFunnelEvent({ sessionId: SID, type: 'step_answered', step: 'prazo', value: '12' })
    expect(await prisma.funnelEvent.count()).toBe(3)
  })

  it('stores step as null for non-step event types', async () => {
    await trackFunnelEvent({ sessionId: SID, type: 'quiz_started', step: 'area' })
    const [row] = await prisma.funnelEvent.findMany()
    expect(row.step).toBeNull()
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

  it('counts a session that skipped stage views up to its furthest stage, with no negative drop', async () => {
    const r = run('sess-SKIPSKIP', Date.parse('2026-10-05T10:00:00Z'))
    r.ev('quiz_started', 0)
    r.ev('step_viewed', 1, 'area')
    r.ev('result_viewed', 2)
    await prisma.funnelEvent.createMany({ data: r.rows })

    const stats = await getFunnelStats()
    expect(stats.stages.map((x) => x.sessions)).toEqual([1, 1, 1, 1, 1, 1, 0])
    expect(stats.stages.every((x) => (x.dropFromPrevious ?? 0) >= 0)).toBe(true)
    expect(stats.recent[0].furthest).toBe('Resultado')
  })

  it('excludes a plan_created session that has no quiz_started', async () => {
    const t = Date.parse('2026-10-05T10:00:00Z')
    const orphan = run('sess-ORPHAN01', t)
    orphan.ev('plan_created', 0)
    const ok = run('sess-STARTED01', t)
    ok.ev('quiz_started', 0)
    ok.ev('step_viewed', 1, 'area')
    await prisma.funnelEvent.createMany({ data: [...orphan.rows, ...ok.rows] })

    const stats = await getFunnelStats()
    expect(stats.starts).toBe(1)
    expect(stats.stages[6].sessions).toBe(0)
    expect(stats.conversion).toBe(0)
    expect(stats.conversion).toBeLessThanOrEqual(100)
  })

  it('averages the two middle values for an even count of plan sessions', async () => {
    const t = Date.parse('2026-10-05T10:00:00Z')
    const rows = [100, 200].flatMap((secs, i) => {
      const r = run(`sess-MEDIAN0${i}`, t + i * 1000_000)
      r.ev('quiz_started', 0)
      r.ev('plan_created', secs)
      return r.rows
    })
    await prisma.funnelEvent.createMany({ data: rows })
    expect((await getFunnelStats()).medianSecondsToPlan).toBe(150)
  })

  describe('answers', () => {
    const T = Date.parse('2026-10-05T10:00:00Z')
    const answersOf = async () => {
      const stats = await getFunnelStats()
      return Object.fromEntries(stats.answers.map((x) => [x.step, x]))
    }

    it('counts each weekday once per session, with the share over sessions that answered dias', async () => {
      const r = run('sess-DAYSONE1', T)
      r.ev('quiz_started', 0)
      r.ev('step_answered', 1, 'dias', 'seg,qua,sex')
      await prisma.funnelEvent.createMany({ data: r.rows })

      const { dias } = await answersOf()
      expect(dias.options.map((o) => [o.value, o.count, o.share])).toEqual([
        ['seg', 1, 100],
        ['qua', 1, 100],
        ['sex', 1, 100],
      ])
    })

    it('computes dias shares over the sessions that answered it', async () => {
      const a = run('sess-DAYSAAAA', T)
      a.ev('quiz_started', 0)
      a.ev('step_answered', 1, 'dias', 'seg,qua')
      const b = run('sess-DAYSBBBB', T + 1000_000)
      b.ev('quiz_started', 0)
      b.ev('step_answered', 1, 'dias', 'seg')
      await prisma.funnelEvent.createMany({ data: [...a.rows, ...b.rows] })

      const { dias } = await answersOf()
      expect(dias.options.map((o) => [o.value, o.count, o.share])).toEqual([
        ['seg', 2, 100],
        ['qua', 1, 50],
      ])
    })

    it('keeps only the latest answer per session and step', async () => {
      const r = run('sess-TWICE001', T)
      r.ev('quiz_started', 0)
      r.ev('step_answered', 1, 'area', 'saude')
      r.ev('step_answered', 5, 'area', 'estudos')
      r.ev('step_answered', 6, 'area', 'estudos')
      await prisma.funnelEvent.createMany({ data: r.rows })

      const { area } = await answersOf()
      expect(area.options.map((o) => [o.value, o.count, o.share])).toEqual([['estudos', 1, 100]])
    })

    it('excludes answers from a session that never recorded quiz_started', async () => {
      const orphan = run('sess-ORPHAN02', T)
      orphan.ev('step_answered', 0, 'area', 'saude')
      const ok = run('sess-STARTED02', T)
      ok.ev('quiz_started', 0)
      ok.ev('step_answered', 1, 'area', 'estudos')
      await prisma.funnelEvent.createMany({ data: [...orphan.rows, ...ok.rows] })

      const { area } = await answersOf()
      expect(area.options.map((o) => [o.value, o.count, o.share])).toEqual([['estudos', 1, 100]])
    })

    it('titles each card with the stage label and orders foco options by definition order', async () => {
      const a = run('sess-FOCOAAAA', T)
      a.ev('quiz_started', 0)
      a.ev('step_answered', 1, 'foco', 'leitura')
      const b = run('sess-FOCOBBBB', T + 1000_000)
      b.ev('quiz_started', 0)
      b.ev('step_answered', 1, 'foco', 'correr')
      await prisma.funnelEvent.createMany({ data: [...a.rows, ...b.rows] })

      const stats = await getFunnelStats()
      expect(stats.answers.map((x) => x.title)).toEqual(['Área', 'Foco', 'Prazo', 'Dias', 'Obstáculo'])
      const { foco } = Object.fromEntries(stats.answers.map((x) => [x.step, x]))
      // Equal counts: ties fall back to definition order (saúde before estudos).
      expect(foco.options.map((o) => o.value)).toEqual(['correr', 'leitura'])
    })
  })
})
