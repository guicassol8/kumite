import type { LoadConfig } from './config'
import type { Recorder } from './recorder'
import { mapLimit } from './schedule'
import { readErrorCode, type Transport } from './transport'

// The world a run plays in (#136), built through the public API exactly as
// the event would: organizer login, signups and logins (argon2, so bounded
// concurrency — 400 at once would exhaust a 4 GB back), teams, and for a run
// with submissions a round of its own. Everything carries the run's id, so
// two runs never collide even without a reset. Nothing is ever deleted.

export type LoadUser = { id: string; email: string; token: string; teamId: string | null }

export type LoadTeam = { id: string; name: string; members: LoadUser[] }

export type World = {
  runId: string
  maxTeamSize: number
  membersPerTeam: number
  emailSuffix: string
  teams: LoadTeam[]
  // Every participant, team-major (t0's members, then t1's, ...).
  users: LoadUser[]
  // What already existed before this run's setup (GET /organizer/stats).
  before: { participants: number; teams: number }
  round: { id: string; name: string } | null
  problemId: string | null
  // Leftover open `load-*` rounds this setup closed (an aborted run's).
  closedLeftoverRounds: string[]
}

export type WorldConfig = Pick<
  LoadConfig,
  'teams' | 'members' | 'setupConcurrency' | 'submissions' | 'durationSeconds' | 'problemId'
>

// The harness's own accounts all share it: they are throwaway, and the
// organizer can still reset any of them from the Painel.
export const LOAD_PASSWORD = 'load-harness-password'

export const LOAD_PREFIX = 'load-'

// The seeded round problem the correct solution (somaDosPares) solves.
export const DEFAULT_PROBLEM_TITLE = 'Soma dos Pares'

/** Base36 timestamp: short, sortable, and unique per run on one machine. */
export function newRunId(now = Date.now()): string {
  return now.toString(36)
}

export function roundNameFor(runId: string): string {
  return `${LOAD_PREFIX}${runId}`
}

/** Minutes the run's round stays open: the load window plus two minutes. */
export function roundMinutesFor(durationSeconds: number): number {
  return Math.ceil((durationSeconds + 120) / 60)
}

type Unread = { status: number; text: () => Promise<string> }

/**
 * A status the call site did not expect: recorded (5xx are already failures
 * of their own) and thrown, so the setup stops at the first broken step.
 */
async function unexpected(
  recorder: Pick<Recorder, 'recordUnexpected'>,
  method: string,
  path: string,
  res: Unread,
  what: string,
): Promise<never> {
  const errorCode = await readErrorCode(res)
  if (res.status < 500)
    recorder.recordUnexpected({ method, url: path, status: res.status, errorCode })
  throw new Error(`${what}: HTTP ${res.status}${errorCode ? ` ${errorCode}` : ''}`)
}

export async function loginOrganizer(
  transport: Transport,
  recorder: Pick<Recorder, 'recordUnexpected'>,
  credentials: { email: string; password: string },
): Promise<string> {
  const res = await transport.api().auth.login.$post({ json: credentials })
  if (res.status !== 200) {
    return unexpected(recorder, 'POST', '/auth/login', res, 'organizer login')
  }
  return (await res.json()).token
}

async function signUpAndLogIn(
  transport: Transport,
  recorder: Recorder,
  email: string,
  index: number,
  code: string,
): Promise<LoadUser> {
  const api = transport.api()
  recorder.actionStarted('signup')
  const signup = await api.auth.signup.$post({
    json: { name: `Carga ${index}`, email, password: LOAD_PASSWORD, code },
  })
  if (signup.status !== 201) {
    return unexpected(recorder, 'POST', '/auth/signup', signup, `signup ${email}`)
  }
  const user = await signup.json()
  recorder.actionCompleted('signup')

  recorder.actionStarted('login')
  const login = await api.auth.login.$post({ json: { email, password: LOAD_PASSWORD } })
  if (login.status !== 200) {
    return unexpected(recorder, 'POST', '/auth/login', login, `login ${email}`)
  }
  const { token } = await login.json()
  recorder.actionCompleted('login')
  return { id: user.id, email, token, teamId: null }
}

async function formTeam(
  transport: Transport,
  recorder: Recorder,
  name: string,
  members: LoadUser[],
): Promise<LoadTeam> {
  const [captain, ...rest] = members
  if (!captain) throw new Error(`team ${name} has no members`)

  recorder.actionStarted('create-team')
  const created = await transport.api(captain.token).teams.$post({ json: { name } })
  if (created.status !== 201) {
    return unexpected(recorder, 'POST', '/teams', created, `create team ${name}`)
  }
  const team = await created.json()
  recorder.actionCompleted('create-team')
  captain.teamId = team.id

  for (const member of rest) {
    recorder.actionStarted('join-team')
    const joined = await transport
      .api(member.token)
      .teams[':id'].join.$post({ param: { id: team.id } })
    if (joined.status !== 200) {
      return unexpected(recorder, 'POST', `/teams/${team.id}/join`, joined, `join team ${name}`)
    }
    recorder.actionCompleted('join-team')
    member.teamId = team.id
  }
  return { id: team.id, name, members }
}

async function findProblemId(
  transport: Transport,
  recorder: Recorder,
  organizerToken: string,
  problemId: string | undefined,
): Promise<string> {
  if (problemId) return problemId
  const res = await transport.api(organizerToken).organizer.problems.$get()
  if (res.status !== 200) {
    return unexpected(recorder, 'GET', '/organizer/problems', res, 'list problems')
  }
  const problems = await res.json()
  const match = problems.find(
    (problem) =>
      problem.status === 'published' &&
      problem.visibility === 'round' &&
      problem.translations.some(
        (t) => t.locale === 'pt' && t.title.trim() === DEFAULT_PROBLEM_TITLE,
      ),
  )
  if (!match) {
    throw new Error(
      `no published round problem titled "${DEFAULT_PROBLEM_TITLE}" (run the seed, or pass --problem-id)`,
    )
  }
  return match.id
}

/**
 * A leftover open `load-*` round is an aborted run's: closed and reported.
 * Any other open round is the event's own, and the harness refuses to touch
 * it — setup fails with its name.
 */
async function clearOpenRounds(
  transport: Transport,
  recorder: Recorder,
  organizerToken: string,
): Promise<string[]> {
  const api = transport.api(organizerToken)
  const res = await api.organizer.rounds.$get()
  if (res.status !== 200) {
    return unexpected(recorder, 'GET', '/organizer/rounds', res, 'list rounds')
  }
  const open = (await res.json()).filter((round) => round.status === 'open')
  const foreign = open.find((round) => !round.name.startsWith(LOAD_PREFIX))
  if (foreign) {
    throw new Error(
      `another round is open: "${foreign.name}" (${foreign.id}). Close it before a run with submissions.`,
    )
  }
  const closed: string[] = []
  for (const round of open) {
    const close = await api.organizer.rounds[':id'].close.$post({ param: { id: round.id } })
    if (close.status !== 200) {
      return unexpected(
        recorder,
        'POST',
        `/organizer/rounds/${round.id}/close`,
        close,
        `close leftover ${round.name}`,
      )
    }
    closed.push(round.name)
  }
  return closed
}

/**
 * Ctrl-C during setup: no new signup, team or round is started (the ones in
 * flight finish), and the setup stops with this error instead of building
 * a world nobody will use — at 8 signups/s, a 300-user setup would
 * otherwise keep going for another minute.
 */
function stopIfAborted(signal: AbortSignal | undefined) {
  if (signal?.aborted) throw new Error('aborted (SIGINT) before the setup finished')
}

export async function setupWorld({
  transport,
  recorder,
  config,
  runId,
  organizerToken,
  signal,
}: {
  transport: Transport
  recorder: Recorder
  config: WorldConfig
  runId: string
  organizerToken: string
  signal?: AbortSignal
}): Promise<World> {
  const org = transport.api(organizerToken)

  const codesRes = await org.organizer['event-codes'].$get()
  if (codesRes.status !== 200) {
    return unexpected(recorder, 'GET', '/organizer/event-codes', codesRes, 'list event codes')
  }
  const code = (await codesRes.json()).find(
    (entry) => entry.active && entry.allowedEmailSuffixes.length > 0,
  )
  if (!code) throw new Error('no active event code with an allowed email suffix')
  const emailSuffix = code.allowedEmailSuffixes[0] as string

  const configRes = await org.organizer['event-config'].$get()
  if (configRes.status !== 200) {
    return unexpected(recorder, 'GET', '/organizer/event-config', configRes, 'read event config')
  }
  const eventConfig = await configRes.json()
  if (config.submissions > 0 && eventConfig.submissionsPaused) {
    throw new Error('submissions are paused by the organizer; resume them before the run')
  }

  const statsRes = await org.organizer.stats.$get()
  if (statsRes.status !== 200) {
    return unexpected(recorder, 'GET', '/organizer/stats', statsRes, 'read event stats')
  }
  const stats = await statsRes.json()
  const before = { participants: stats.participants.total, teams: stats.teams.total }
  if (before.participants > 0 || before.teams > 0) {
    recorder.recordWarning(
      `the database was not clean before setup: ${before.participants} participant(s), ${before.teams} team(s) already existed. Reset it (and restart the back) between runs you want to compare.`,
    )
  }

  const membersPerTeam = Math.min(config.members, eventConfig.maxTeamSize)
  const emails = Array.from(
    { length: config.teams * membersPerTeam },
    (_, i) => `${LOAD_PREFIX}${runId}-u${i}@${emailSuffix}`,
  )
  const users = await mapLimit(emails, config.setupConcurrency, async (email, i) => {
    stopIfAborted(signal)
    return signUpAndLogIn(transport, recorder, email, i, code.code)
  })

  const groups = Array.from({ length: config.teams }, (_, t) =>
    users.slice(t * membersPerTeam, (t + 1) * membersPerTeam),
  )
  const teams = await mapLimit(groups, config.setupConcurrency, async (members, t) => {
    stopIfAborted(signal)
    return formTeam(transport, recorder, `${LOAD_PREFIX}${runId}-t${t}`, members)
  })

  let round: World['round'] = null
  let problemId: string | null = null
  const closedLeftoverRounds: string[] = []
  if (config.submissions > 0) {
    stopIfAborted(signal)
    problemId = await findProblemId(transport, recorder, organizerToken, config.problemId)
    closedLeftoverRounds.push(...(await clearOpenRounds(transport, recorder, organizerToken)))
    for (const name of closedLeftoverRounds) {
      recorder.recordWarning(`closed a leftover open round from an earlier run: ${name}`)
    }

    const name = roundNameFor(runId)
    const created = await org.organizer.rounds.$post({
      json: {
        name,
        durationMinutes: roundMinutesFor(config.durationSeconds),
        problemIds: [problemId],
      },
    })
    if (created.status !== 201) {
      return unexpected(recorder, 'POST', '/organizer/rounds', created, `create round ${name}`)
    }
    const { id } = await created.json()
    const opened = await org.organizer.rounds[':id'].open.$post({ param: { id } })
    if (opened.status !== 200) {
      return unexpected(recorder, 'POST', `/organizer/rounds/${id}/open`, opened, `open ${name}`)
    }
    round = { id, name }
  }

  return {
    runId,
    maxTeamSize: eventConfig.maxTeamSize,
    membersPerTeam,
    emailSuffix,
    teams,
    users,
    before,
    round,
    problemId,
    closedLeftoverRounds,
  }
}

/** Closes the run's round, if it opened one. Deletes nothing. */
export async function teardownWorld({
  transport,
  recorder,
  organizerToken,
  round,
}: {
  transport: Transport
  recorder: Pick<Recorder, 'recordUnexpected'>
  organizerToken: string
  round: World['round']
}): Promise<void> {
  if (!round) return
  const res = await transport
    .api(organizerToken)
    .organizer.rounds[':id'].close.$post({ param: { id: round.id } })
  if (res.status !== 200) {
    await unexpected(
      recorder,
      'POST',
      `/organizer/rounds/${round.id}/close`,
      res,
      `close ${round.name}`,
    )
  }
}
