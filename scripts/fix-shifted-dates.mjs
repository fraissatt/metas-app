// Repairs calendar days written at 00:00Z by the UTC server before days were
// pinned to Brasília. Dry run by default: it only prints what it found.
//
//   npm run db:fix-shifted-dates                                   # report only
//   npm run db:fix-shifted-dates -- --apply                        # repair dates
//   npm run db:fix-shifted-dates -- --apply --move-outside-week    # also move old chip tasks a day forward
//
// Uses DATABASE_URL_UNPOOLED when set (the repair is one transaction, which
// Neon's pooled URL doesn't hold well), else DATABASE_URL; .env is loaded.
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { createJiti } from 'jiti'
import { PrismaClient } from '@prisma/client'

config()

const jiti = createJiti(import.meta.url, { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } })
const { planRepair, applyRepair } = await jiti.import('../src/lib/shifted-dates.ts')

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || ''
const target = (() => {
  try {
    const parsed = new URL(url)
    return `${parsed.host}${parsed.pathname}`
  } catch {
    return '(URL do banco inválida)'
  }
})()

const apply = process.argv.includes('--apply')
const moveOutsideWeek = process.argv.includes('--move-outside-week')

const db = new PrismaClient({ datasourceUrl: url })
try {
  console.log(`Banco: ${target}`)
  const plan = await planRepair(db)
  console.log(`Datas gravadas à meia-noite UTC: ${plan.tasks} tarefas, ${plan.goals} metas semanais, ${plan.objectives} objetivos`)
  if (plan.outsideWeek.length > 0) {
    console.log(`\nTarefas que ficariam fora da semana da meta (botões de dia antigos):`)
    for (const t of plan.outsideWeek) console.log(`  ${t.email} · ${t.title} · ${t.day} (semana de ${t.weekStart})`)
    console.log('Use --move-outside-week junto com --apply para movê-las um dia para frente.')
  }
  if (apply) {
    await applyRepair(db, { moveOutsideWeek })
    console.log(moveOutsideWeek ? '\nCorrigido, incluindo as tarefas fora da semana.' : '\nCorrigido.')
  } else {
    console.log('\nNada foi alterado (rode com --apply para corrigir).')
  }
} finally {
  await db.$disconnect()
}
