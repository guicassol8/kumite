import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

import postgres from 'postgres'

import { assertLocalDatabaseUrl } from './local-database'
import { DEFAULT_DATABASE_URL, gitDiscoveryEnv, readDotenv, testDatabaseUrl } from './test-database'

// db:drop-worktree (#395): the databases a linked worktree leaves on the local
// Postgres — the back suite's `<db>_test_<dir>` (#392) and the E2E/hurl
// database `pnpm worktree:env` gave it (#404) — dropped when
// `pnpm worktree:prune` removes that worktree. Never the main checkout's own
// database or its `<db>_test`, never a database on another server, never a
// server that is not local. Free of config.ts, like db:create. Database URLs
// are never printed — they carry the password.

type EnvLike = Record<string, string | undefined>

function databaseName(url: string): string {
  return decodeURIComponent(new URL(url).pathname.replace(/^\//, ''))
}

export type WorktreeDatabasesInput = {
  /** The main checkout's DATABASE_URL (its back/.env, else the default). */
  mainUrl: string
  /** Other bases the suite may have derived from — an exported DATABASE_URL. */
  otherBases?: (string | undefined)[]
  /** The removed worktree's back/.env DATABASE_URL, when it has one. */
  worktreeUrl?: string | undefined
  /** The removed worktree's directory name — the suite's slug. */
  dir: string
}

/**
 * The databases a removed worktree may have left behind, as URLs on the main
 * checkout's server: `<base>_test_<dir>` for every base the suite could have
 * derived from, plus the worktree's own database and its `_test_<dir>`.
 * Candidates only — {@link dropDatabases} drops the ones that exist.
 */
export function worktreeDatabaseCandidates(input: WorktreeDatabasesInput): string[] {
  const bases = [input.mainUrl, ...(input.otherBases ?? [])].filter((url): url is string => !!url)
  const protectedNames = new Set(['postgres', 'template0', 'template1'])
  for (const base of bases) {
    protectedNames.add(databaseName(base))
    protectedNames.add(databaseName(testDatabaseUrl(base)))
  }
  const host = new URL(input.mainUrl).host
  const candidates = bases.map((base) => testDatabaseUrl(base, input.dir))
  if (input.worktreeUrl) {
    candidates.push(input.worktreeUrl, testDatabaseUrl(input.worktreeUrl, input.dir))
  }
  const seen = new Set<string>()
  return candidates.filter((url) => {
    const name = databaseName(url)
    if (protectedNames.has(name) || seen.has(name)) return false
    // A worktree pointing at another server (a Docker Postgres on its own
    // port) is not ours to drop: worktree:prune removes that container.
    if (new URL(url).host !== host) return false
    seen.add(name)
    return true
  })
}

/** The statement that drops `name`. WITH (FORCE) (Postgres 13+) ends a
 * leftover dev server's sessions instead of failing on them. */
export function dropStatement(name: string): string {
  return `drop database if exists "${name.replace(/"/g, '""')}" with (force)`
}

/**
 * Drops each database in `urls` that exists, through the `postgres`
 * maintenance database of `mainUrl`'s server; with `dryRun`, only reports
 * them. Returns the names it dropped (or would drop). Local servers only.
 * `execute` runs each drop statement — the real connection by default; the
 * test passes a recorder, because a DROP DATABASE forces an immediate
 * checkpoint, and one racing the suite's writes on WSL took minutes and
 * timed out every database test beside it (#404).
 */
export async function dropDatabases(
  mainUrl: string,
  urls: string[],
  dryRun: boolean,
  log: (line: string) => void = console.log,
  execute?: (statement: string) => Promise<unknown>,
): Promise<string[]> {
  assertLocalDatabaseUrl(mainUrl, 'db:drop-worktree')
  const maintenance = new URL(mainUrl)
  maintenance.pathname = '/postgres'
  const sql = postgres(maintenance.toString(), { max: 1, onnotice: () => {} })
  const run = execute ?? ((statement: string) => sql.unsafe(statement))
  const names: string[] = []
  try {
    for (const url of urls) {
      const name = databaseName(url)
      const rows = await sql`select 1 from pg_database where datname = ${name}`
      if (rows.length === 0) continue
      if (dryRun) {
        log(`would drop database ${name}`)
      } else {
        await run(dropStatement(name))
        log(`dropped database ${name}`)
      }
      names.push(name)
    }
  } finally {
    await sql.end()
  }
  return names
}

/** The main checkout's base URL: its back/.env first — an exported
 * DATABASE_URL may name a worktree's database — then the environment. */
export function mainDatabaseUrl(backDir: string, env: EnvLike = process.env): string {
  return readDotenv(backDir)['DATABASE_URL'] || env['DATABASE_URL'] || DEFAULT_DATABASE_URL
}

// Usage (from the main checkout's back/): db:drop-worktree <worktree> [--dry-run]
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2).filter((arg) => arg !== '--')
  const dryRun = args.includes('--dry-run')
  const worktree = args.find((arg) => arg !== '--dry-run')
  if (!worktree) {
    console.error('usage: pnpm db:drop-worktree <worktree path> [--dry-run]')
    process.exit(2)
  }
  // The main checkout is git's first worktree — not this script's own tree,
  // which may be a linked worktree whose back/.env names its own database.
  const mainTree =
    execFileSync('git', ['worktree', 'list', '--porcelain'], {
      encoding: 'utf8',
      env: gitDiscoveryEnv(),
    })
      .split('\n')[0]
      ?.replace(/^worktree /, '') ?? join(import.meta.dirname, '..', '..', '..')
  const mainUrl = mainDatabaseUrl(join(mainTree, 'back'))
  try {
    assertLocalDatabaseUrl(mainUrl, 'db:drop-worktree')
  } catch {
    console.log('db:drop-worktree: the database server is not local — nothing dropped')
    process.exit(0)
  }
  const dir = worktree.replace(/\/+$/, '').split('/').pop() ?? ''
  const urls = worktreeDatabaseCandidates({
    mainUrl,
    otherBases: [process.env['DATABASE_URL']],
    worktreeUrl: readDotenv(join(worktree, 'back'))['DATABASE_URL'],
    dir,
  })
  try {
    const names = await dropDatabases(mainUrl, urls, dryRun)
    if (names.length === 0) console.log('db:drop-worktree: no database of this worktree left')
  } catch (error) {
    // Postgres down must not stop the prune: the databases stay, reported.
    console.log(
      `db:drop-worktree: could not reach Postgres (${(error as Error).message}) — nothing dropped`,
    )
  }
}
