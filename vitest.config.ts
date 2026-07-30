import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { config } from 'dotenv'

config({ path: '.env.test' })

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Test files share one Postgres test database (see src/test/setup.ts),
    // so they must run sequentially — parallel files racing truncation
    // against inserts produces flaky cross-file failures.
    fileParallelism: false,
  },
})
