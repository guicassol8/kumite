import { generateSolution, somaDosPares } from '@kumite/blocks'

/**
 * Shared bench harness for the #17 spike — throwaway, deleted before the PR
 * (see back/docs/adr/0001-judge-sandbox-engine.md). Each candidate engine
 * file (engine-*.ts) imports this module so every measurement is produced
 * the same way and the numbers in results.md are comparable.
 */

/** The judge always calls `solve(input)`, never a class method (#4 contract). */
export const SOLUTION_FUNCTION_NAME = 'solve'

/** Realistic payload: the same source the judge would generate for a submission. */
export const REALISTIC_SOURCE = generateSolution(somaDosPares)

/**
 * Hostile payloads Blockly's curated toolbox cannot produce — hand-written to
 * probe the trust boundary each engine is supposed to enforce. Every source
 * defines `solve(input)` so the executors can call it uniformly.
 */
export const HOSTILE_SOURCES: Record<string, string> = {
  infiniteLoopNoAlloc: `function solve(input) { let x = 0; while (true) { x = x + 1 } return x }`,
  memoryBomb: `function solve(input) { const a = []; while (true) { a.push(new Array(1e6).fill(0)) } return a.length }`,
  requireFs: `function solve(input) { const fs = require('node:fs'); return fs.readdirSync('.') }`,
  importFs: `function solve(input) { return import('node:fs').then((m) => m.readdirSync('.')) }`,
  processExit: `function solve(input) { process.exit(0) }`,
  fetchNetwork: `function solve(input) { return fetch('http://169.254.169.254/').then((r) => r.status) }`,
}

export const CASE_COUNTS = [1, 10, 50] as const

/** One realistic `solve(input)` call per case: a list of random ints to sum the evens of. */
export function randomEvenSumInput(size = 20): number[] {
  return Array.from({ length: size }, () => Math.floor(Math.random() * 1000))
}

export type CaseOutcome = 'ok' | 'timeout' | 'memory' | 'blocked' | 'error'

export type CaseResult = {
  outcome: CaseOutcome
  value?: unknown
  detail?: string
  ms: number
}

/** An engine-specific single-case runner: fresh context per call, enforcing timeout + memory. */
export type ExecuteCase = (params: {
  source: string
  timeoutMs: number
  memoryMb: number
  input: unknown
}) => Promise<CaseResult>

export type CurveReport = {
  caseCount: number
  totalMs: number
  perCaseMs: number[]
  results: CaseResult[]
}

export type EventLoopLag = { p50Ms: number; maxMs: number }

/**
 * Samples the event loop every 20ms while `run` is in flight. The delta past
 * the 20ms target is the lag — what separates an in-process engine (quickjs)
 * from one that offloads to a worker.
 */
export async function withEventLoopLag<T>(run: () => Promise<T>): Promise<{
  result: T
  lag: EventLoopLag
}> {
  const samples: number[] = []
  const intervalMs = 20
  let last = performance.now()
  const timer = setInterval(() => {
    const now = performance.now()
    samples.push(Math.max(0, now - last - intervalMs))
    last = now
  }, intervalMs)

  try {
    const result = await run()
    const sorted = [...samples].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    const p50Ms = sorted.length > 0 ? (sorted[mid] ?? 0) : 0
    const maxMs = sorted.length > 0 ? (sorted[sorted.length - 1] ?? 0) : 0
    return { result, lag: { p50Ms, maxMs } }
  } finally {
    clearInterval(timer)
  }
}

/** Runs one case count (1, 10 or 50) of the realistic payload through an engine. */
export async function runCurve(
  execute: ExecuteCase,
  source: string,
  caseCount: number,
  timeoutMs: number,
  memoryMb: number,
): Promise<CurveReport> {
  const results: CaseResult[] = []
  const perCaseMs: number[] = []
  const start = performance.now()
  for (let i = 0; i < caseCount; i++) {
    const result = await execute({ source, timeoutMs, memoryMb, input: randomEvenSumInput() })
    results.push(result)
    perCaseMs.push(result.ms)
  }
  const totalMs = performance.now() - start
  return { caseCount, totalMs, perCaseMs, results }
}

/** Runs every hostile payload once each, for the "what does it do to bad input" table. */
export async function runHostileBattery(
  execute: ExecuteCase,
  timeoutMs: number,
  memoryMb: number,
): Promise<Record<string, CaseResult>> {
  const entries = await Promise.all(
    Object.entries(HOSTILE_SOURCES).map(async ([name, source]) => {
      const result = await execute({ source, timeoutMs, memoryMb, input: [] })
      return [name, result] as const
    }),
  )
  return Object.fromEntries(entries)
}

function average(values: number[]): number {
  return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0
}

export function printEngineReport(params: {
  engine: string
  coldStartMs: number
  curves: CurveReport[]
  eventLoopLag: EventLoopLag
  hostile: Record<string, CaseResult>
  note?: string
}): void {
  const { engine, coldStartMs, curves, eventLoopLag, hostile, note } = params
  console.log(`\n=== ${engine} ===`)
  console.log(`cold start: ${coldStartMs.toFixed(1)}ms`)
  for (const curve of curves) {
    console.log(
      `  cases=${curve.caseCount} total=${curve.totalMs.toFixed(1)}ms ` +
        `avgPerCase=${average(curve.perCaseMs).toFixed(2)}ms`,
    )
  }
  console.log(
    `event loop lag while running: p50=${eventLoopLag.p50Ms.toFixed(2)}ms max=${eventLoopLag.maxMs.toFixed(2)}ms`,
  )
  console.log('hostile battery:')
  for (const [name, result] of Object.entries(hostile)) {
    console.log(`  ${name}: ${result.outcome}${result.detail ? ` (${result.detail})` : ''}`)
  }
  if (note) {
    console.log(`note: ${note}`)
  }
}

const isMain = import.meta.url === `file://${process.argv[1]}`
if (isMain) {
  console.log('realistic solve source (generateSolution(somaDosPares)):\n')
  console.log(REALISTIC_SOURCE)
  console.log('\nhostile payloads:')
  for (const name of Object.keys(HOSTILE_SOURCES)) {
    console.log(`  - ${name}`)
  }
}
