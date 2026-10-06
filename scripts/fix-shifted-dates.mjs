// Repairs calendar days written at 00:00Z by the UTC server before days were
// pinned to Brasília. Dry run by default: it only prints counts. Pass --apply
// to write. Point DATABASE_URL at the database to check (defaults to .env).
//
//   npm run db:fix-shifted-dates            # counts only
//   npm run db:fix-shifted-dates -- --apply # writes
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { createJiti } from 'jiti'
import { PrismaClient } from '@prisma/client'

config()

const jiti = createJiti(import.meta.url, { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } })
const { planRepair, applyRepair } = await jiti.import('../src/lib/shifted-dates.ts')

const url = process.env.DATABASE_URL ?? ''
const host = (() => {
  try {
    return new URL(url).host
  } catch {
    return '(DATABASE_URL inválida)'
  }
})()

const db = new PrismaClient()
try {
  console.log(`Banco: ${host}`)
  const counts = await planRepair(db)
  console.log(`A corrigir: ${counts.tasks} tarefas, ${counts.goals} metas semanais, ${counts.objectives} objetivos`)
  if (process.argv.includes('--apply')) {
    await applyRepair(db)
    console.log('Corrigido.')
  } else {
    console.log('Nada foi alterado (rode com --apply para corrigir).')
  }
} finally {
  await db.$disconnect()
}
