import type { LoadConfig } from './config'
import type { Recorder } from './recorder'
import { isBadAt, sleep } from './schedule'
import { readErrorCode, type Transport } from './transport'
import { classifyVerdict, rejectedVerdict, type SubmissionKind } from './verdict'
import { WORKSPACES } from './workspaces'
import type { LoadTeam, LoadUser, World } from './world'

// The submission load (#136): one loop per team, as a team would play —
// one submission at a time (the back allows one in flight per team), the
// cooldown after each, the members taking turns. The kind of each
// submission comes from a global index, so the sequence is the same on
// every run with the same config.

// Retries of a 429 before the submission counts as rejected.
export const MAX_THROTTLE_RETRIES = 3

export type SubmitterConfig = Pick<LoadConfig, 'submissions' | 'badFraction' | 'cooldownMs'>

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
  for (let attempt = 0; ; attempt++) {
    let res: Awaited<ReturnType<typeof api.submissions.$post>>
    try {
      res = await api.submissions.$post({
        json: { problemId: target.problemId, roundId: target.roundId, workspace: WORKSPACES[kind] },
      })
    } catch {
      // Network error or timeout: recorded by the transport. The action
      // stays started-not-completed, which the report counts as a failure.
      return
    }

    if (res.status === 201) {
      recorder.recordVerdict(kind, classifyVerdict(await res.json()))
      recorder.actionCompleted('submission')
      return
    }

    // 429 is the expected answer to a team going too fast: wait, try again.
    if (res.status === 429 && attempt < MAX_THROTTLE_RETRIES) {
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
  world: Pick<World, 'teams' | 'round' | 'problemId'>
  config: SubmitterConfig
  deadline: number
  signal?: AbortSignal
  clock?: () => number
}): Promise<void> {
  if (config.submissions === 0) return
  if (!world.round || !world.problemId) {
    throw new Error('a run with submissions needs a round and a problem')
  }
  const target: Target = { roundId: world.round.id, problemId: world.problemId }
  let next = 0

  const teamLoop = async (team: LoadTeam) => {
    let turn = 0
    while (!signal?.aborted && clock() < deadline && next < config.submissions) {
      const index = next
      next += 1
      const member = team.members[turn % team.members.length]
      turn += 1
      if (!member) return
      const kind: SubmissionKind = isBadAt(index, config.badFraction) ? 'loop' : 'correct'
      await submitOne({
        transport,
        recorder,
        target,
        member,
        kind,
        cooldownMs: config.cooldownMs,
        signal,
      })
      if (config.cooldownMs > 0) await sleep(config.cooldownMs, signal)
    }
  }

  await Promise.all(world.teams.map(teamLoop))
}
