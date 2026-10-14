import { monitorEventLoopDelay, performance } from 'node:perf_hooks'

import type { Phase, Recorder } from './recorder'

// The harness's own load (#442): its CPU, event-loop utilization and
// event-loop delay, sampled in its own process. With 400 streams the harness
// parses every frame on every connection; when its loop saturates, the
// heartbeat gaps, the poll gaps and the latencies it reports measure itself,
// not the back. These samples let the report say so (report.ts).

/** One cumulative read of the process: `at` in epoch ms, the rest since start. */
export type HarnessReading = {
  at: number
  cpuMicros: number
  // performance.eventLoopUtilization(): cumulative ms idle and active.
  elu: { idle: number; active: number }
}

export type HarnessSample = {
  // Harness clock (epoch ms) at the end of the window — what phases are cut by.
  at: number
  phase: Phase
  // CPU % of one core over the window (helper threads count, so it can pass 100).
  cpuPercent: number | null
  // Event-loop utilization over the window, 0 to 1.
  elu: number | null
  // Event-loop delay over the window, from monitorEventLoopDelay.
  lagP99Ms: number | null
  lagMaxMs: number | null
}

export type LagReader = {
  // The window's p99 and max, then a fresh window.
  take: () => { p99Ms: number | null; maxMs: number | null }
  stop: () => void
}

/**
 * CPU % and ELU between two reads. Both use the real time elapsed, so a
 * timer that fired late (a saturated loop) still gives the right values.
 * Null when the reads are not ordered in time.
 */
export function harnessWindow(
  prev: HarnessReading,
  next: HarnessReading,
): { cpuPercent: number | null; elu: number | null } {
  const elapsedMs = next.at - prev.at
  const idle = next.elu.idle - prev.elu.idle
  const active = next.elu.active - prev.elu.active
  if (elapsedMs <= 0 || idle < 0 || active < 0) return { cpuPercent: null, elu: null }
  return {
    cpuPercent: Math.max(0, ((next.cpuMicros - prev.cpuMicros) / 1000 / elapsedMs) * 100),
    elu: idle + active > 0 ? active / (idle + active) : null,
  }
}

function readProcess(): HarnessReading {
  const { user, system } = process.cpuUsage()
  const { idle, active } = performance.eventLoopUtilization()
  return { at: Date.now(), cpuMicros: user + system, elu: { idle, active } }
}

const NS_PER_MS = 1e6

function histogramLag(): LagReader {
  const histogram = monitorEventLoopDelay({ resolution: 10 })
  histogram.enable()
  return {
    take() {
      const out =
        histogram.count === 0
          ? { p99Ms: null, maxMs: null }
          : { p99Ms: histogram.percentile(99) / NS_PER_MS, maxMs: histogram.max / NS_PER_MS }
      histogram.reset()
      return out
    },
    stop: () => histogram.disable(),
  }
}

/**
 * Samples the harness's own process every `intervalMs`, tagging each sample
 * with the recorder's phase at the end of its window. The timer is unref'd:
 * it never keeps the process alive. `stop()` takes one last sample.
 */
export function startHarnessSampler({
  recorder,
  intervalMs,
  read = readProcess,
  lag = histogramLag,
}: {
  recorder: Pick<Recorder, 'phase'>
  intervalMs: number
  read?: () => HarnessReading
  lag?: () => LagReader
}) {
  const samples: HarnessSample[] = []
  const delay = lag()
  let prev = read()

  const tick = () => {
    const next = read()
    const { p99Ms, maxMs } = delay.take()
    samples.push({
      at: next.at,
      phase: recorder.phase(),
      ...harnessWindow(prev, next),
      lagP99Ms: p99Ms,
      lagMaxMs: maxMs,
    })
    prev = next
  }
  const timer = setInterval(tick, intervalMs)
  timer.unref()

  return {
    samples: () => [...samples],
    /** Stops sampling after one last sample, and returns them all. */
    stop: (): HarnessSample[] => {
      clearInterval(timer)
      tick()
      delay.stop()
      return [...samples]
    },
  }
}
