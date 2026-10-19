import { availableParallelism } from 'node:os'
import path from 'node:path'

import { defineConfig } from 'vitest/config'

// At most 4 jsdom workers (#476). Vitest's default is one per core minus one
// (11 on a 12-core dev machine), and each jsdom fork holds ~250 MB: two front
// suites at once (two worktrees, or a pre-push next to a stress loop) peaked
// at 23 forks and 5.7 GB of RSS on an 8 GB machine. Swap went from 554 MB to
// 1 GB, the whole machine stalled for ~38 s, and 13 screen tests died on the
// 1 s findBy/waitFor or the 5 s test timeout (cases that take 0.2–1.4 s idle
// lasted 6–27 s). Measured with the back and front suites looping alongside:
// render-to-ready of organizer.event-config's first case, max over the runs,
// was 1187 ms with the default, 570 ms with 6 and 346 ms with 4 workers. With 4
// every screen case stayed under half its budget. The pre-push `pnpm -r test`
// waits on the back suite either way: 181 s mean idle by default, 191 s with 4.
// Never above the default, so a smaller machine (CI) keeps its own count.
const MAX_WORKERS = Math.max(1, Math.min(4, availableParallelism() - 1))

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    maxWorkers: MAX_WORKERS,
    setupFiles: [
      './src/test/i18n-jsdom.ts',
      './src/test/web-storage-jsdom.ts',
      // Before blockly-jsdom on purpose: its fetch shim wraps the guard, so
      // the sound preloads it answers itself never reach it (#168).
      './src/test/network-guard-jsdom.ts',
      './src/test/blockly-jsdom.ts',
      './src/test/router-jsdom.ts',
      './src/test/radix-select-jsdom.ts',
      './src/test/match-media-jsdom.ts',
    ],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
