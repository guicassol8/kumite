import { execFileSync } from 'node:child_process'
import { existsSync, realpathSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'

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

/** `url` parsed, or `undefined` when it is not a URL. Never the TypeError:
 * Node attaches the input — password included — to it, and prints it. */
function parseUrl(url: string | undefined): URL | undefined {
  if (!url) return undefined
  try {
    return new URL(url)
  } catch {
    return undefined
  }
}

function decode(text: string): string {
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}

function databaseName(url: string | URL): string {
  const parsed = typeof url === 'string' ? parseUrl(url) : url
  return parsed ? decode(parsed.pathname.replace(/^\//, '')) : ''
}

/** The database `url` names, even when it does not parse (an unexpanded
 * `${DB_PORT}` in a back/.env): the text after its last `/`. For protecting
 * a name only — never for choosing one to drop. */
function looseName(url: string): string {
  const parsed = parseUrl(url)
  if (parsed) return databaseName(parsed)
  return decode(
    url
      .replace(/[?#].*$/, '')
      .split('/')
      .pop() ?? '',
  )
}

/** `text` with the credentials of every URL in it masked, for an error
 * message the CLI prints. */
export function redact(text: string): string {
  return text.replace(/:\/\/[^/@\s]*@/g, '://***@')
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
  /** Databases other worktrees still use (their back/.env DATABASE_URL):
   * never candidates, whatever the removed worktree's back/.env names. */
  keep?: (string | undefined)[]
}

/**
 * The databases a removed worktree may have left behind, as URLs on the main
 * checkout's server: `<base>_test_<dir>` for every base the suite could have
 * derived from, plus the worktree's own database and its `_test_<dir>`.
 * Candidates only — {@link dropDatabases} drops the ones that exist.
 */
export function worktreeDatabaseCandidates(input: WorktreeDatabasesInput): string[] {
  const main = parseUrl(input.mainUrl)
  if (!main) return []
  // A URL that does not parse is no base to derive from, but the database it
  // seems to name stays protected all the same.
  const named = [input.mainUrl, ...(input.otherBases ?? [])].filter((url): url is string => !!url)
  const bases = named.filter((url) => parseUrl(url))
  const protectedNames = new Set(['postgres', 'template0', 'template1'])
  for (const url of [...named, ...(input.keep ?? [])]) if (url) protectedNames.add(looseName(url))
  for (const base of bases) protectedNames.add(databaseName(testDatabaseUrl(base)))
  const host = main.host
  const candidates = bases.map((base) => testDatabaseUrl(base, input.dir))
  const own = input.worktreeUrl
  if (own && parseUrl(own)) candidates.push(own, testDatabaseUrl(own, input.dir))
  const seen = new Set<string>()
  return candidates.filter((url) => {
    const name = databaseName(url)
    if (protectedNames.has(name) || seen.has(name)) return false
    // A worktree pointing at another server (a Docker Postgres on its own
    // port) is not ours to drop: worktree:prune removes that container.
    if (parseUrl(url)?.host !== host) return false
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

/** The worktree argument as an absolute path. pnpm runs the script from
 * back/, so a relative path is resolved against the directory pnpm was
 * invoked from (INIT_CWD) — against back/ it named nothing, and the tool
 * reported "no database left" while the worktree's database was still there. */
export function worktreeDir(arg: string, env: EnvLike = process.env, cwd = process.cwd()): string {
  return resolve(env['INIT_CWD'] || cwd, arg)
}

/** Every worktree `git worktree list --porcelain` names, main checkout first. */
function listWorktrees(): string[] {
  return execFileSync('git', ['worktree', 'list', '--porcelain'], {
    encoding: 'utf8',
    env: gitDiscoveryEnv(),
  })
    .split('\n')
    .filter((line) => line.startsWith('worktree '))
    .map((line) => line.slice('worktree '.length))
}

const realpath = (path: string) => (existsSync(path) ? realpathSync(path) : path)

/**
 * The back/.env DATABASE_URL of every tree in `trees` but `worktree` itself,
 * compared by real path — a relative or symlinked spelling of the removed
 * worktree must not protect its own database. These are what {@link
 * worktreeDatabaseCandidates} keeps.
 */
export function otherWorktreeUrls(
  trees: string[],
  worktree: string,
  readUrl: (tree: string) => string | undefined = (tree) =>
    readDotenv(join(tree, 'back'))['DATABASE_URL'],
): (string | undefined)[] {
  const self = realpath(worktree)
  return trees.filter((tree) => realpath(tree) !== self).map(readUrl)
}

// Usage: db:drop-worktree <worktree> [--dry-run] — a relative path is taken
// from where pnpm was run. Exit 0: done, nothing to do, or Postgres down (the
// databases stay, reported — a prune never waits on it). Exit 1: anything
// unexpected, so worktree:prune keeps the tree whose back/.env names them.
async function main(argv: string[]): Promise<number> {
  const args = argv.filter((arg) => arg !== '--')
  const dryRun = args.includes('--dry-run')
  const arg = args.find((a) => a !== '--dry-run')
  if (!arg) {
    console.error('usage: pnpm db:drop-worktree <worktree path> [--dry-run]')
    return 2
  }
  const worktree = worktreeDir(arg)
  const dir = basename(worktree)
  // The main checkout is git's first worktree — not this script's own tree,
  // which may be a linked worktree whose back/.env names its own database.
  const trees = listWorktrees()
  const mainTree = trees[0] ?? join(import.meta.dirname, '..', '..', '..')
  const mainUrl = mainDatabaseUrl(join(mainTree, 'back'))
  try {
    assertLocalDatabaseUrl(mainUrl, 'db:drop-worktree')
  } catch {
    console.log(
      'db:drop-worktree: the database server is not local (or DATABASE_URL is not a URL) — nothing dropped',
    )
    return 0
  }
  if (!existsSync(worktree)) {
    console.log(
      `db:drop-worktree: no directory at ${worktree} — only the suite databases named after "${dir}" are looked for`,
    )
  }
  const worktreeUrl = readDotenv(join(worktree, 'back'))['DATABASE_URL']
  if (worktreeUrl && !URL.canParse(worktreeUrl)) {
    console.log(
      "db:drop-worktree: this worktree's DATABASE_URL is not a URL — only its suite databases are looked for",
    )
  }
  // A database another worktree's back/.env still names is never dropped —
  // a copied back/.env must not take a live worktree's database with it.
  const urls = worktreeDatabaseCandidates({
    mainUrl,
    otherBases: [process.env['DATABASE_URL']],
    worktreeUrl,
    dir,
    keep: otherWorktreeUrls(trees, worktree),
  })
  try {
    const names = await dropDatabases(mainUrl, urls, dryRun)
    if (names.length === 0) console.log('db:drop-worktree: no database of this worktree left')
  } catch (error) {
    console.log(
      `db:drop-worktree: could not reach Postgres (${redact((error as Error).message)}) — nothing dropped`,
    )
  }
  return 0
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    process.exitCode = await main(process.argv.slice(2))
  } catch (error) {
    // Only the message, redacted: a printed error object carries its input.
    console.log(`db:drop-worktree: failed (${redact(String((error as Error).message))})`)
    process.exitCode = 1
  }
}
