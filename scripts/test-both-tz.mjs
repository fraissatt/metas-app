// Runs the suite once per time zone: UTC is the Vercel server, Sao_Paulo is a
// local machine. Day math that only works in one of them is a bug.
import { spawnSync } from 'node:child_process'

const extra = process.argv.slice(2)
let failed = false
for (const tz of ['UTC', 'America/Sao_Paulo']) {
  console.log(`\n=== TZ=${tz} ===`)
  const run = spawnSync('npx', ['vitest', 'run', ...extra], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, TZ: tz },
  })
  if (run.status !== 0) failed = true
}
process.exit(failed ? 1 : 0)
