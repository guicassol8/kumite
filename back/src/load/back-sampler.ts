import type { EventLoopWindow, LiveStats, ProcessStats } from '../modules/stats/stats.schema'

import type { Phase, Recorder } from './recorder'
import { sleep } from './schedule'
import { readErrorCode, type Transport } from './transport'

// Polls the back's own view of itself while the harness drives it (#136):
// /organizer/stats/process (CPU, memory, event-loop windows) and
// /organizer/stats/live (judge queue, SSE connections), as the organizer.
// Each sample carries the phase it was taken in.

export type BackSample = {
  // Harness clock (epoch ms) when the poll answered — what phases are cut by.
  at: number
  phase: Phase
  process: ProcessStats | null
  live: LiveStats | null
}

/**
 * Back CPU % between two reads, from the cumulative user+system time over the
 * back's own clock. 100% = one core busy; the judge threads count, so it can
 * pass 100. Null when the reads are not ordered in time.
 */
export function cpuPercent(prev: ProcessStats, next: ProcessStats): number | null {
  const elapsedMs = next.sampledAt - prev.sampledAt
  if (elapsedMs <= 0) return null
  const cpuMicros =
    next.cpu.userMicros + next.cpu.systemMicros - (prev.cpu.userMicros + prev.cpu.systemMicros)
  return Math.max(0, (cpuMicros / 1000 / elapsedMs) * 100)
}

/**
 * Every distinct event-loop window seen across the samples, oldest first. A
 * read returns the whole ring, so consecutive samples overlap: windows are
 * keyed by `endedAt`.
 */
export function mergeWindows(samples: readonly BackSample[]): EventLoopWindow[] {
  const byEnd = new Map<number, EventLoopWindow>()
  for (const sample of samples) {
    for (const window of sample.process?.eventLoop.windows ?? []) byEnd.set(window.endedAt, window)
  }
  return [...byEnd.values()].sort((a, b) => a.endedAt - b.endedAt)
}

export function startBackSampler({
  transport,
  recorder,
  organizerToken,
  intervalMs,
  clock = () => Date.now(),
}: {
  transport: Transport
  recorder: Pick<Recorder, 'phase' | 'recordUnexpected'>
  organizerToken: string
  intervalMs: number
  clock?: () => number
}) {
  const samples: BackSample[] = []
  const controller = new AbortController()
  const api = transport.api(organizerToken)

  const readProcess = async (): Promise<ProcessStats | null> => {
    try {
      const res = await api.organizer.stats.process.$get({ query: {} })
      if (res.status === 200) return await res.json()
      const errorCode = await readErrorCode(res)
      if (res.status < 500) {
        recorder.recordUnexpected({
          method: 'GET',
          url: '/organizer/stats/process',
          status: res.status,
          errorCode,
        })
      }
    } catch {
      // recorded by the transport
    }
    return null
  }

  const readLive = async (): Promise<LiveStats | null> => {
    try {
      const res = await api.organizer.stats.live.$get()
      if (res.status === 200) return await res.json()
      const errorCode = await readErrorCode(res)
      if (res.status < 500) {
        recorder.recordUnexpected({
          method: 'GET',
          url: '/organizer/stats/live',
          status: res.status,
          errorCode,
        })
      }
    } catch {
      // recorded by the transport
    }
    return null
  }

  const pollOnce = async () => {
    const phase = recorder.phase()
    const [process, live] = await Promise.all([readProcess(), readLive()])
    samples.push({ at: clock(), phase, process, live })
  }

  const loop = (async () => {
    while (!controller.signal.aborted) {
      await pollOnce()
      await sleep(intervalMs, controller.signal)
    }
  })()

  return {
    samples: () => [...samples],
    /** Stops polling after one last sample, and returns them all. */
    stop: async (): Promise<BackSample[]> => {
      controller.abort()
      await loop
      await pollOnce()
      return [...samples]
    },
  }
}
