import { availableParallelism, loadavg } from 'node:os'

import { type BackSample, startBackSampler } from './back-sampler'
import type { LoadConfig } from './config'
import { createRecorder } from './recorder'
import { buildReport, type LoadReport, type WorldSummary } from './report'
import { sleep } from './schedule'
import { connectSse, type FetchLike, type SseConnection } from './sse-client'
import { runSubmissions } from './submitter'
import { createTransport, type Transport } from './transport'
import {
  type LoadUser,
  loginOrganizer,
  newRunId,
  setupWorld,
  teardownWorld,
  type World,
} from './world'

// One run, end to end (#136): rest → setup → sse-ramp → sse-idle (baseline)
// or load (smoke) → teardown. Nothing here aborts the run on a failure: an
// error stops the phase it happened in, the teardown always runs, and the
// report always comes out — partial, with `aborted`, on Ctrl-C.

function summarizeWorld(world: World): WorldSummary {
  return {
    teams: world.teams.length,
    participants: world.users.length,
    membersPerTeam: world.membersPerTeam,
    maxTeamSize: world.maxTeamSize,
    before: world.before,
    round: world.round,
    problemId: world.problemId,
    closedLeftoverRounds: world.closedLeftoverRounds,
  }
}

/**
 * Opens `count` connections round-robin across the participants, at `perSecond`
 * connections per second. Each connect runs on its own; the ramp waits for
 * all of them before the next phase starts.
 */
async function rampSse({
  transport,
  users,
  count,
  perSecond,
  connectTimeoutMs,
  recorder,
  signal,
}: {
  transport: Transport
  users: LoadUser[]
  count: number
  perSecond: number
  connectTimeoutMs: number
  recorder: ReturnType<typeof createRecorder>
  signal?: AbortSignal
}): Promise<SseConnection[]> {
  if (count === 0 || users.length === 0) return []
  const gapMs = 1000 / perSecond
  const started = Date.now()
  const pending: Promise<SseConnection>[] = []
  for (let i = 0; i < count && !signal?.aborted; i++) {
    const user = users[i % users.length] as LoadUser
    pending.push(
      connectSse({
        url: `${transport.baseUrl}/sse`,
        token: user.token,
        fetch: transport.rawFetch,
        connectTimeoutMs,
        recorder,
      }),
    )
    const nextAt = started + (i + 1) * gapMs
    const wait = nextAt - Date.now()
    if (wait > 0 && i + 1 < count) await sleep(wait, signal)
  }
  return Promise.all(pending)
}

export type RunOptions = {
  config: LoadConfig
  // Injected by the in-process tests (app.fetch); the real fetch otherwise.
  fetch?: FetchLike
  signal?: AbortSignal
  runId?: string
  commit?: string | null
  log?: (message: string) => void
}

export async function runScenario({
  config,
  fetch,
  signal,
  runId = newRunId(),
  commit = null,
  log = () => {},
}: RunOptions): Promise<LoadReport> {
  const startedAt = Date.now()
  const loadavgStart = loadavg()
  const recorder = createRecorder()
  const transport = createTransport({
    baseUrl: config.url,
    recorder,
    requestTimeoutMs: config.requestTimeoutMs,
    fetch,
  })

  let world: World | null = null
  let organizerToken: string | null = null
  let sampler: ReturnType<typeof startBackSampler> | null = null
  let connections: SseConnection[] = []
  let samples: BackSample[] = []

  try {
    recorder.setPhase('rest')
    log(`run ${runId}: ${config.scenario} against ${config.url}`)
    organizerToken = await loginOrganizer(transport, recorder, {
      email: config.organizerEmail,
      password: config.organizerPassword,
    })
    sampler = startBackSampler({
      transport,
      recorder,
      organizerToken,
      intervalMs: config.sampleIntervalMs,
    })
    log(`rest: ${config.restSeconds}s`)
    await sleep(config.restSeconds * 1000, signal)

    if (!signal?.aborted) {
      recorder.setPhase('setup')
      log(`setup: ${config.teams} team(s) × ${config.members} member(s)`)
      world = await setupWorld({ transport, recorder, config, runId, organizerToken, signal })
    }

    if (world && !signal?.aborted) {
      recorder.setPhase('sse-ramp')
      log(`sse-ramp: ${config.sse} connection(s) at ${config.sseRamp}/s`)
      connections = await rampSse({
        transport,
        users: world.users,
        count: config.sse,
        perSecond: config.sseRamp,
        connectTimeoutMs: config.requestTimeoutMs,
        recorder,
        signal,
      })
    }

    if (world && !signal?.aborted) {
      const loaded = config.submissions > 0
      recorder.setPhase(loaded ? 'load' : 'sse-idle')
      log(`${loaded ? 'load' : 'sse-idle'}: ${config.durationSeconds}s`)
      const deadline = Date.now() + config.durationSeconds * 1000
      if (loaded) {
        await runSubmissions({ transport, recorder, world, config, deadline, signal })
        const started = recorder.snapshot().actions['submission']?.started ?? 0
        if (started < config.submissions && !signal?.aborted) {
          recorder.recordWarning(
            `only ${started} of ${config.submissions} submissions started before the ${config.durationSeconds}s deadline`,
          )
        }
      }
      await sleep(Math.max(0, deadline - Date.now()), signal)
    }
  } catch (error) {
    recorder.recordError(error instanceof Error ? error.message : String(error))
  } finally {
    recorder.setPhase('teardown')
    log('teardown')
    await Promise.all(connections.map((connection) => connection.close()))
    if (organizerToken && world?.round) {
      try {
        await teardownWorld({ transport, recorder, organizerToken, round: world.round })
      } catch (error) {
        recorder.recordError(error instanceof Error ? error.message : String(error))
      }
    }
    if (sampler) samples = await sampler.stop()
    recorder.endPhases()
  }

  return buildReport({
    config,
    runId,
    startedAt,
    endedAt: Date.now(),
    aborted: signal?.aborted ?? false,
    environment: {
      node: process.version,
      commit,
      loadavgStart,
      loadavgEnd: loadavg(),
      parallelism: availableParallelism(),
    },
    recorder: recorder.snapshot(),
    world: world ? summarizeWorld(world) : null,
    sse: { requested: config.sse, connections: connections.map((c) => c.report()) },
    samples,
  })
}

/** 0 passed, 1 failed. (2, a configuration error, never gets this far.) */
export function exitCodeFor(report: LoadReport): 0 | 1 {
  return report.status === 'PASS' ? 0 : 1
}
