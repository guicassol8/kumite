import type { JudgeRun } from '../modules/judge/judge.schema'
import type { SseConnect, SseEmission } from '../modules/sse/sse.schema'
import type { EventLoopWindow, LiveStats, ProcessStats } from '../modules/stats/stats.schema'

import type { Phase, Recorder } from './recorder'
import { sleep } from './schedule'
import { readErrorCode, resendIfStale, type Transport } from './transport'

// Polls the back's own view of itself while the harness drives it (#136):
// /organizer/stats/process (CPU, memory, event-loop windows) and
// /organizer/stats/live (judge queue, SSE connections), as the organizer.
// Each sample carries the phase it was taken in. From #137/#138 each poll
// passes the previous answer's `sampledAt` as `?since=`, so it only carries
// the judge runs, SSE emissions and connects that are new.

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

export type MergedTimings = {
  judgeRuns: JudgeRun[]
  emissions: SseEmission[]
  connects: SseConnect[]
}

function uniqueBySeq<T extends { seq: number }>(lists: T[][]): T[] {
  const bySeq = new Map<number, T>()
  for (const list of lists) for (const entry of list) bySeq.set(entry.seq, entry)
  return [...bySeq.values()].sort((a, b) => a.seq - b.seq)
}

/**
 * Every judge run, SSE emission and connect seen across the samples, once
 * each, in `seq` order. `since` is inclusive, so consecutive polls can
 * repeat an entry that ended on the boundary millisecond.
 */
export function mergeTimings(samples: readonly BackSample[]): MergedTimings {
  const reads = samples.flatMap((sample) => (sample.process ? [sample.process] : []))
  return {
    judgeRuns: uniqueBySeq(reads.map((read) => read.judge.runs)),
    emissions: uniqueBySeq(reads.map((read) => read.sse.emissions)),
    connects: uniqueBySeq(reads.map((read) => read.sse.connects)),
  }
}

export function startBackSampler({
  transport,
  recorder,
  organizerToken,
  intervalMs,
  clock = () => Date.now(),
}: {
  transport: Transport
  recorder: Pick<Recorder, 'phase' | 'recordUnexpected' | 'recordRetry'>
  organizerToken: string
  intervalMs: number
  clock?: () => number
}) {
  const samples: BackSample[] = []
  const controller = new AbortController()
  const api = transport.api(organizerToken)

  // The previous answer's own clock, never the harness's: the two can drift.
  let since: number | undefined

  const readProcess = async (): Promise<ProcessStats | null> => {
    try {
      const res = await resendIfStale(transport, recorder, 'GET', '/organizer/stats/process', () =>
        api.organizer.stats.process.$get({ query: since === undefined ? {} : { since } }),
      )
      if (res.status === 200) {
        const stats = await res.json()
        since = stats.sampledAt
        return stats
      }
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
      const res = await resendIfStale(transport, recorder, 'GET', '/organizer/stats/live', () =>
        api.organizer.stats.live.$get(),
      )
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
