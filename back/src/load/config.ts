import { readFileSync } from 'node:fs'
import { parseArgs, parseEnv } from 'node:util'

import { z } from 'zod'

// The harness's configuration (#136): a scenario preset, overridden by any
// flag, with the target and the organizer taken from the environment. Never
// imports ../config.ts — that one validates the back's own environment
// (JWT_SECRET and friends), which a load run against a remote back has no
// business needing.

export const SCENARIOS = ['baseline', 'smoke', 'burst'] as const
export type ScenarioName = (typeof SCENARIOS)[number]

const positiveInt = z.coerce.number().int().positive()
const nonNegativeInt = z.coerce.number().int().nonnegative()

export const LoadConfigSchema = z.object({
  scenario: z.enum(SCENARIOS),
  url: z
    .string()
    .url()
    .transform((url) => url.replace(/\/+$/, '')),
  teams: positiveInt,
  // Capped at the event's maxTeamSize during setup.
  members: positiveInt,
  // Connections opened round-robin across the participants.
  sse: nonNegativeInt,
  // Total across all teams.
  submissions: nonNegativeInt,
  badFraction: z.coerce.number().min(0).max(1),
  // Among the bad submissions, the share that are memory bombs (#137); the
  // rest are infinite loops.
  memoryShare: z.coerce.number().min(0).max(1),
  // Problems in the run's round: the base one plus clones of it (#138).
  problems: positiveInt,
  // The load phase ends when every submission is over; `durationSeconds` is
  // then only the deadline for starting new ones (#137).
  untilDone: z.boolean(),
  // After the load, close every stream and reopen as many, spread over
  // `stormWindowSeconds` (0 = all at once) (#138).
  storm: z.boolean(),
  stormWindowSeconds: z.coerce.number().nonnegative(),
  // Closed rounds created before the run's own, each with one correct
  // submission per team: getEventRanking's cost grows with them (#138).
  pastRounds: nonNegativeInt,
  // Send a request again once after the back closed a reused keep-alive
  // socket under it (#138). Off: Caddy, in front of the back in production,
  // does not resend a POST either, so the harness models it.
  resendStale: z.boolean(),
  restSeconds: z.coerce.number().nonnegative(),
  durationSeconds: z.coerce.number().positive(),
  setupConcurrency: positiveInt,
  // Connections opened per second.
  sseRamp: z.coerce.number().positive(),
  sampleIntervalMs: positiveInt,
  requestTimeoutMs: positiveInt,
  // What the harness waits after each submission of a team; matches the
  // back's SUBMISSION_COOLDOWN_MS by default.
  cooldownMs: nonNegativeInt,
  out: z.string().min(1),
  problemId: z.string().uuid().optional(),
  allowRemote: z.boolean(),
  organizerEmail: z.string().email(),
  organizerPassword: z.string().min(1),
})

export type LoadConfig = z.infer<typeof LoadConfigSchema>

type Preset = Omit<
  LoadConfig,
  'scenario' | 'url' | 'out' | 'problemId' | 'allowRemote' | 'organizerEmail' | 'organizerPassword'
>

const COMMON = {
  setupConcurrency: 4,
  sseRamp: 50,
  sampleIntervalMs: 1000,
  requestTimeoutMs: 60_000,
  cooldownMs: 5000,
  // Neutral: baseline and smoke run exactly as #136 measured them.
  memoryShare: 0,
  problems: 1,
  untilDone: false,
  storm: false,
  stormWindowSeconds: 0,
  pastRounds: 0,
  resendStale: false,
} as const

export const PRESETS: Record<ScenarioName, Preset> = {
  // Idle connections only: what the back costs at rest and with N streams.
  baseline: {
    ...COMMON,
    teams: 100,
    members: 3,
    sse: 400,
    submissions: 0,
    badFraction: 0,
    restSeconds: 60,
    durationSeconds: 120,
  },
  // A small round: every path exercised once, quick enough to run often.
  smoke: {
    ...COMMON,
    teams: 10,
    members: 2,
    sse: 20,
    submissions: 30,
    badFraction: 0.1,
    restSeconds: 10,
    durationSeconds: 90,
  },
  // The first wave (#137, #138): 100 teams submitting at once on a round of
  // 5 problems, 400 streams watching, then a reconnect storm.
  burst: {
    ...COMMON,
    teams: 100,
    members: 3,
    sse: 400,
    problems: 5,
    // 3 per team: the first wave is all 100 teams at the same moment.
    submissions: 300,
    badFraction: 0.1,
    memoryShare: 0.5,
    restSeconds: 30,
    durationSeconds: 600,
    untilDone: true,
    // Under undici's 300 s headersTimeout, so a timeout is always the
    // harness's own: a submission waiting longer has failed anyway.
    requestTimeoutMs: 290_000,
    storm: true,
    stormWindowSeconds: 0,
  },
}

// Flag name → config key, for every numeric/string flag.
const FLAGS = {
  url: 'url',
  teams: 'teams',
  members: 'members',
  sse: 'sse',
  submissions: 'submissions',
  'bad-fraction': 'badFraction',
  'memory-share': 'memoryShare',
  problems: 'problems',
  'storm-window': 'stormWindowSeconds',
  'past-rounds': 'pastRounds',
  rest: 'restSeconds',
  duration: 'durationSeconds',
  'setup-concurrency': 'setupConcurrency',
  'sse-ramp': 'sseRamp',
  'sample-interval': 'sampleIntervalMs',
  'request-timeout': 'requestTimeoutMs',
  cooldown: 'cooldownMs',
  out: 'out',
  'problem-id': 'problemId',
} as const satisfies Record<string, keyof LoadConfig>

// Boolean flags that a preset may turn on: `--storm` / `--no-storm`.
const TOGGLES = {
  'until-done': 'untilDone',
  storm: 'storm',
  'resend-stale': 'resendStale',
} as const satisfies Record<string, keyof LoadConfig>

export const USAGE = `Usage: pnpm load <baseline|smoke|burst> [flags]

  --url <url>                 target API (LOAD_API_URL; default http://localhost:$PORT)
  --teams <n>                 teams to create
  --members <n>               members per team (capped at the event's maxTeamSize)
  --sse <n>                   /sse connections, round-robin across participants
  --submissions <n>           total submissions (0 = no round)
  --bad-fraction <0..1>       share of bad submissions (infinite loops or memory bombs)
  --memory-share <0..1>       among the bad ones, the share of memory bombs
  --problems <n>              problems in the run's round (clones of the base one)
  --past-rounds <n>           closed rounds created first, one correct submission per team
  --[no-]until-done           load ends when every submission is over (--duration: start deadline)
  --[no-]storm                after the load, close every stream and reopen as many
  --storm-window <s>          spread the storm's reconnects over s seconds (0 = at once)
  --[no-]resend-stale         resend once after a stale keep-alive socket (masks the Caddy→back race)
  --rest <s>                  idle seconds before setup
  --duration <s>              seconds of idle SSE (baseline) or load (smoke, burst)
  --setup-concurrency <n>     signups/logins in flight
  --sse-ramp <n>              connections opened per second
  --sample-interval <ms>      back metrics polling interval
  --request-timeout <ms>      per-request timeout
  --cooldown <ms>             wait after each submission of a team
  --out <dir>                 where load-results/<scenario>-<runId>/ goes
  --problem-id <uuid>         problem to submit to (default: "Soma dos Pares")
  --allow-remote              allow a non-local --url (never resets anything)

Organizer credentials: ORGANIZER_EMAIL / ORGANIZER_PASSWORD (shell, else back/.env).
See back/src/load/README.md.`

/** Reads a .env file into a plain object; a missing or unreadable file is {}. */
export function readEnvFile(path: string | URL): Record<string, string> {
  try {
    const parsed = parseEnv(readFileSync(path, 'utf8'))
    const out: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed)) if (value !== undefined) out[key] = value
    return out
  } catch {
    return {}
  }
}

export type ConfigResult = { ok: true; config: LoadConfig } | { ok: false; message: string }

/**
 * argv (without node and the script) → config. Precedence: flag > preset for
 * the shape of the run; shell env > back/.env for the target and the
 * organizer. Never throws: a bad value comes back as a message naming it.
 */
export function parseLoadConfig({
  argv,
  env,
  envFile = {},
  defaultOut,
}: {
  argv: string[]
  env: Record<string, string | undefined>
  envFile?: Record<string, string>
  defaultOut: string
}): ConfigResult {
  let parsed: ReturnType<typeof parseCli>
  try {
    parsed = parseCli(argv)
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
  const { values, positionals } = parsed

  const scenario = positionals[0]
  if (!scenario || !SCENARIOS.includes(scenario as ScenarioName)) {
    return {
      ok: false,
      message: `scenario must be one of ${SCENARIOS.join(', ')} (got ${scenario ?? 'nothing'})`,
    }
  }
  if (positionals.length > 1) {
    return { ok: false, message: `unexpected argument: ${positionals[1]}` }
  }

  const fromEnv = (key: string) => env[key] || envFile[key] || undefined
  const raw: Record<string, unknown> = {
    ...PRESETS[scenario as ScenarioName],
    scenario,
    url: env['LOAD_API_URL'] || `http://localhost:${fromEnv('PORT') ?? '3000'}`,
    out: defaultOut,
    allowRemote: values['allow-remote'] === true,
    organizerEmail: fromEnv('ORGANIZER_EMAIL'),
    organizerPassword: fromEnv('ORGANIZER_PASSWORD'),
  }
  for (const [flag, key] of Object.entries(FLAGS)) {
    const value = values[flag]
    if (typeof value === 'string') raw[key] = value
  }
  for (const [flag, key] of Object.entries(TOGGLES)) {
    const value = values[flag]
    if (typeof value === 'boolean') raw[key] = value
  }

  const result = LoadConfigSchema.safeParse(raw)
  if (!result.success) {
    const issues = result.error.issues.map((issue) => {
      const key = String(issue.path[0] ?? '')
      const flag = Object.entries({ ...FLAGS, ...TOGGLES }).find(([, k]) => k === key)?.[0]
      const name =
        key === 'organizerEmail'
          ? 'ORGANIZER_EMAIL'
          : key === 'organizerPassword'
            ? 'ORGANIZER_PASSWORD'
            : flag
              ? `--${flag}`
              : key
      return `${name}: ${issue.message}`
    })
    return { ok: false, message: `invalid configuration:\n  ${issues.join('\n  ')}` }
  }
  return { ok: true, config: result.data }
}

function parseCli(argv: string[]) {
  const options: Record<string, { type: 'string' | 'boolean' }> = {
    'allow-remote': { type: 'boolean' },
    help: { type: 'boolean' },
  }
  for (const flag of Object.keys(FLAGS)) options[flag] = { type: 'string' }
  for (const flag of Object.keys(TOGGLES)) options[flag] = { type: 'boolean' }
  return parseArgs({
    args: argv,
    options,
    allowPositionals: true,
    allowNegative: true,
    strict: true,
  })
}

export function wantsHelp(argv: string[]): boolean {
  return argv.includes('--help') || argv.includes('-h')
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

/**
 * The harness signs up hundreds of accounts and opens a round: pointed at the
 * VPS by accident, that is the event's real database. A non-local host needs
 * --allow-remote, said out loud. Returns the refusal, or null when allowed.
 */
export function assertTargetAllowed(url: string, allowRemote: boolean): string | null {
  const { hostname } = new URL(url)
  if (LOCAL_HOSTS.has(hostname) || allowRemote) return null
  return `refusing to load ${hostname}: not a local host. Pass --allow-remote to target it on purpose (the harness never resets a remote database; its load-<runId> data stays there).`
}
