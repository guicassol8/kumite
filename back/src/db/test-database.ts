import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { parseEnv } from 'node:util'

import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

// The back suite's own database (#392). Its tests truncate `users` and every
// other table, so running them against the database a Playwright run, the hurl
// suite or a dev server is using wipes that seed mid-run — the Stop hook did
// exactly that, and every seeded login turned into a 401. The suite now always
// runs against a database derived from the base DATABASE_URL: same server and
// credentials, `<db>_test` in the main checkout (and CI), `<db>_test_<slug>`
// in a linked worktree, so two worktrees never truncate each other either.
//
// Deliberately free of `../config`: vitest.config.ts and the globalSetup run in
// the main vitest process, where importing config.ts would demand JWT_SECRET.

/** Same default as config.ts and drizzle.config.ts. */
export const DEFAULT_DATABASE_URL = 'postgres://kumite:kumite@localhost:5433/kumite'

/** Postgres truncates identifiers past 63 bytes (NAMEDATALEN - 1). */
const MAX_IDENTIFIER_BYTES = 63

type EnvLike = Record<string, string | undefined>

function databaseNameOf(url: URL): string {
  return decodeURIComponent(url.pathname.replace(/^\//, ''))
}

function normalizeSlug(slug: string): string {
  return slug
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

/**
 * Swaps only the database name of `baseUrl`: `<db>_test`, or `<db>_test_<slug>`
 * when a worktree slug is given. A name past 63 bytes is cut and suffixed with
 * 8 hex chars of its sha1, so it stays unique and stable per worktree.
 */
export function testDatabaseUrl(baseUrl: string, slug?: string): string {
  const url = new URL(baseUrl)
  const normalized = slug === undefined ? '' : normalizeSlug(slug)
  let name = `${databaseNameOf(url)}_test${normalized ? `_${normalized}` : ''}`
  if (Buffer.byteLength(name) > MAX_IDENTIFIER_BYTES) {
    const hash = createHash('sha1').update(name).digest('hex').slice(0, 8)
    name = `${Buffer.from(name)
      .subarray(0, MAX_IDENTIFIER_BYTES - 9)
      .toString()}_${hash}`
  }
  url.pathname = `/${encodeURIComponent(name)}`
  return url.toString()
}

/** The variables git exports to its hooks to point them at a repository. */
const GIT_REPOSITORY_VARIABLES = [
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_COMMON_DIR',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_PREFIX',
]

/**
 * `env` without the variables that pin git to one repository (#407). Run from
 * a git hook — the pre-push ladder — they made git answer about the hook's
 * repository from any directory, and made a test fixture's `git commit` land
 * on a real branch. With them gone, git discovers the repository from `cwd`.
 */
export function gitDiscoveryEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const clean = { ...env }
  for (const key of GIT_REPOSITORY_VARIABLES) delete clean[key]
  return clean
}

/**
 * The directory name of the linked git worktree containing `cwd`, or
 * `undefined` in the main checkout (and outside git, or when git fails).
 */
export function worktreeSlug(cwd: string): string | undefined {
  let lines: string[]
  try {
    lines = execFileSync(
      'git',
      [
        'rev-parse',
        '--path-format=absolute',
        '--absolute-git-dir',
        '--git-common-dir',
        '--show-toplevel',
      ],
      { cwd, env: gitDiscoveryEnv(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    )
      .trim()
      .split('\n')
  } catch {
    return undefined
  }
  const [gitDir, commonDir, toplevel] = lines
  if (!gitDir || !commonDir || !toplevel || gitDir === commonDir) return undefined
  return basename(toplevel)
}

/** `<dir>/.env` parsed without touching process.env; empty when absent. */
export function readDotenv(dir: string): EnvLike {
  try {
    return parseEnv(readFileSync(join(dir, '.env'), 'utf8'))
  } catch {
    return {}
  }
}

/**
 * DATABASE_URL resolved the way config.ts resolves it — the real environment,
 * then back/.env, then the default — without config.ts's validation.
 */
export function resolveDatabaseUrl(env: EnvLike, dotenv: EnvLike): string {
  return env['DATABASE_URL'] || dotenv['DATABASE_URL'] || DEFAULT_DATABASE_URL
}

/**
 * The suite's database URL. `TEST_DATABASE_URL` wins outright; otherwise the
 * base from {@link resolveDatabaseUrl}, renamed by {@link testDatabaseUrl}.
 */
export function resolveTestDatabaseUrl(env: EnvLike, dotenv: EnvLike, slug?: string): string {
  const explicit = env['TEST_DATABASE_URL']
  if (explicit) return explicit
  return testDatabaseUrl(resolveDatabaseUrl(env, dotenv), slug)
}

/** {@link resolveTestDatabaseUrl} for the back package rooted at `backDir`. */
export function resolveTestDatabaseUrlFor(backDir: string, env: EnvLike = process.env): string {
  return resolveTestDatabaseUrl(env, readDotenv(backDir), worktreeSlug(backDir))
}

function errorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : undefined
}

/**
 * Creates the database named in `url` when it does not exist yet, through the
 * `postgres` maintenance database of the same server. Safe to race: a
 * concurrent creator's `42P04 duplicate_database` counts as "existed", and a
 * busy template (`55006`) is retried.
 */
export async function ensureDatabase(url: string): Promise<'created' | 'existed'> {
  const target = new URL(url)
  const name = databaseNameOf(target)
  const maintenance = new URL(url)
  maintenance.pathname = '/postgres'
  const sql = postgres(maintenance.toString(), { max: 1, onnotice: () => {} })
  try {
    for (let attempt = 0; ; attempt++) {
      const rows = await sql`select 1 from pg_database where datname = ${name}`
      if (rows.length > 0) return 'existed'
      try {
        await sql.unsafe(`create database "${name.replace(/"/g, '""')}"`)
        return 'created'
      } catch (error) {
        const code = errorCode(error)
        if (code === '42P04') return 'existed'
        if (code === '55006' && attempt < 5) {
          await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)))
          continue
        }
        throw error
      }
    }
  } finally {
    await sql.end()
  }
}

/** back/drizzle, the migrations `drizzle-kit migrate` applies. */
export const MIGRATIONS_FOLDER = join(import.meta.dirname, '..', '..', 'drizzle')

/**
 * Applies back/drizzle to `url`, recording them in the same
 * `drizzle.__drizzle_migrations` table `drizzle-kit migrate` uses. An advisory
 * lock serializes two runs migrating the same database at once.
 */
export async function migrateDatabase(url: string): Promise<void> {
  const sql = postgres(url, { max: 1, onnotice: () => {} })
  try {
    await sql`select pg_advisory_lock(hashtext('kumite:test-database:migrate'))`
    await migrate(drizzle(sql), { migrationsFolder: MIGRATIONS_FOLDER })
  } finally {
    await sql.end()
  }
}
