import { performance } from 'node:perf_hooks'

import type { LoadConfig } from './config'
import type { Recorder } from './recorder'
import { kindAt, sleep } from './schedule'
import { detailOf, isStaleSocket, readErrorCode, type Transport } from './transport'
import { classifyVerdict, rejectedVerdict, type SubmissionKind } from './verdict'
import { WORKSPACES } from './workspaces'
import type { LoadTeam, LoadUser, World } from './world'

// The submission load (#136): one loop per team, as a team would play —
// one submission at a time (the back allows one in flight per team), the
// cooldown after each, the members taking turns, and the team's k-th
// submission on the round's problem k mod n (#138). The kind of each
// submission comes from a global index, so the sequence is the same on
// every run with the same config.

// Retries of a 429 before the submission counts as rejected.
export const MAX_THROTTLE_RETRIES = 3

export type SubmitterConfig = Pick<LoadConfig, 'submissions' | 'badFraction' | 'cooldownMs'> &
  Partial<Pick<LoadConfig, 'memoryShare'>>

type Target = { roundId: string; problemId: string }

async function submitOne({
  transport,
  recorder,
  target,
  member,
  kind,
  cooldownMs,
  signal,
}: {
  transport: Transport
  recorder: Recorder
  target: Target
  member: LoadUser
  kind: SubmissionKind
  cooldownMs: number
  signal?: AbortSignal
}): Promise<void> {
  recorder.actionStarted('submission')
  const api = transport.api(member.token)
  let resent = false
  let throttled = 0
  for (;;) {
    let res: Awaited<ReturnType<typeof api.submissions.$post>>
    const started = performance.now()
    try {
      res = await api.submissions.$post({
        json: { problemId: target.problemId, roundId: target.roundId, workspace: WORKSPACES[kind] },
      })
    } catch (error) {
      // Network error or timeout: recorded by the transport. With
      // --resend-stale, a stale keep-alive socket is resent once and the
      // retry counted; anything else leaves the action started-not-completed,
      // a failure.
      const detail = detailOf(error)
      if (transport.resendStale && !resent && detail && isStaleSocket(detail) && !signal?.aborted) {
        resent = true
        recorder.recordRetry({ method: 'POST', url: '/submissions', detail })
        continue
      }
      return
    }

    if (res.status === 201) {
      // The transport has read the body already: this is until its last byte.
      recorder.recordSubmissionLatency(kind, performance.now() - started)
      recorder.recordVerdict(kind, classifyVerdict(await res.json()))
      recorder.actionCompleted('submission')
      return
    }

    // 429 is the expected answer to a team going too fast: wait, try again.
    if (res.status === 429 && throttled < MAX_THROTTLE_RETRIES) {
      throttled += 1
      await sleep(Math.max(cooldownMs, 1000), signal)
      if (signal?.aborted) return
      continue
    }

    // Any other answer is a verdict that cannot be coherent. A non-429 4xx
    // is also an unexpected status on the route; a 5xx is a failure of its
    // own already.
    const errorCode = await readErrorCode(res)
    if (res.status < 500 && res.status !== 429) {
      recorder.recordUnexpected({
        method: 'POST',
        url: '/submissions',
        status: res.status,
        errorCode,
      })
    }
    recorder.recordVerdict(kind, rejectedVerdict(errorCode ?? `http_${res.status}`))
    recorder.actionCompleted('submission')
    return
  }
}

/**
 * Sends `config.submissions` submissions in total, spread over the teams, and
 * stops starting new ones at `deadline` (epoch ms) or when `signal` aborts.
 * Resolves when every loop is done; what is in flight at the deadline is
 * bounded by the transport's request timeout.
 */
export async function runSubmissions({
  transport,
  recorder,
  world,
  config,
  deadline,
  signal,
  clock = () => Date.now(),
}: {
  transport: Transport
  recorder: Recorder
  world: Pick<World, 'teams' | 'round' | 'problemIds'>
  config: SubmitterConfig
  deadline: number
  signal?: AbortSignal
  clock?: () => number
}): Promise<void> {
  if (config.submissions === 0) return
  const round = world.round
  const problemIds = world.problemIds
  if (!round || problemIds.length === 0) {
    throw new Error('a run with submissions needs a round and a problem')
  }
  const memoryShare = config.memoryShare ?? 0
  let next = 0

  const teamLoop = async (team: LoadTeam) => {
    let turn = 0
    while (!signal?.aborted && clock() < deadline && next < config.submissions) {
      const index = next
      next += 1
      const member = team.members[turn % team.members.length]
      const problemId = problemIds[turn % problemIds.length] as string
      turn += 1
      if (!member) return
      const kind: SubmissionKind = kindAt(index, config.badFraction, memoryShare)
      await submitOne({
        transport,
        recorder,
        target: { roundId: round.id, problemId },
        member,
        kind,
        cooldownMs: config.cooldownMs,
        signal,
      })
      // No cooldown after the last one: with --until-done it would only
      // stretch the load phase.
      if (config.cooldownMs > 0 && next < config.submissions) await sleep(config.cooldownMs, signal)
    }
  }

  await Promise.all(world.teams.map(teamLoop))
}
