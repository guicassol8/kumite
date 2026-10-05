import type { ProcessStats } from '../modules/stats/stats.schema'

// Test fixtures shared by the harness's unit tests: never imported by the
// harness itself.

/** The judge and SSE sections of a process read with nothing recorded yet. */
export function emptyTimings(): Pick<ProcessStats, 'judge' | 'sse'> {
  return {
    judge: {
      config: { concurrency: 4, timeoutMs: 2000, memoryMb: 64 },
      workers: { spawned: 0, exited: 0, alive: 0 },
      runs: [],
    },
    sse: { emissions: [], connects: [] },
  }
}
