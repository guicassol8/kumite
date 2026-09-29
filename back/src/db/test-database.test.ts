import { execFileSync } from 'node:child_process'
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  ensureDatabase,
  resolveDatabaseUrl,
  resolveTestDatabaseUrl,
  testDatabaseUrl,
  worktreeSlug,
} from './test-database'

// #392: the back suite truncates `users` and friends, so it must never share a
// database with the E2E, hurl or a dev server. These cases pin how its own
// database is named; the last block proves the suite really runs there.

const BASE = 'postgres://kumite:kumite@localhost:5487/kumite'

function databaseName(url: string): string {
  return decodeURIComponent(new URL(url).pathname.slice(1))
}

describe('testDatabaseUrl', () => {
  it('appends _test to the database name in the main checkout', () => {
    expect(testDatabaseUrl(BASE)).toBe('postgres://kumite:kumite@localhost:5487/kumite_test')
  })

  it('appends _test_<slug> in a linked worktree, normalizing the slug', () => {
    expect(databaseName(testDatabaseUrl(BASE, 'task-392-stop-hook'))).toBe(
      'kumite_test_task_392_stop_hook',
    )
    expect(databaseName(testDatabaseUrl(BASE, 'Agent.A63--90'))).toBe('kumite_test_agent_a63_90')
  })

  it('keeps credentials, host, port and query untouched', () => {
    const url = new URL(
      testDatabaseUrl('postgres://user:p%40ss@127.0.0.1:5433/app?sslmode=disable', 'wt'),
    )
    expect(url.username).toBe('user')
    expect(url.password).toBe('p%40ss')
    expect(url.hostname).toBe('127.0.0.1')
    expect(url.port).toBe('5433')
    expect(url.search).toBe('?sslmode=disable')
    expect(url.pathname).toBe('/app_test_wt')
  })

  it('caps the name at Postgres’s 63 bytes, stably and without collisions', () => {
    const long = 'x'.repeat(80)
    const name = databaseName(testDatabaseUrl(BASE, long))
    expect(Buffer.byteLength(name)).toBeLessThanOrEqual(63)
    expect(name.startsWith('kumite_test_x')).toBe(true)
    expect(databaseName(testDatabaseUrl(BASE, long))).toBe(name)
    expect(databaseName(testDatabaseUrl(BASE, `${long}y`))).not.toBe(name)
  })
})

describe('worktreeSlug', () => {
  let dir: string

  beforeAll(() => {
    dir = realpathSync(mkdtempSync(join(tmpdir(), 'kumite-392-')))
    const git = (cwd: string, ...args: string[]) =>
      execFileSync('git', args, { cwd, stdio: 'ignore' })
    git(dir, 'init', '-q', 'main')
    writeFileSync(join(dir, 'main', 'f'), 'x')
    git(join(dir, 'main'), 'add', 'f')
    git(join(dir, 'main'), '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'init')
    git(join(dir, 'main'), 'worktree', 'add', '-q', join(dir, 'task-392-stop-hook'))
  })

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('is undefined in the main checkout', () => {
    expect(worktreeSlug(join(dir, 'main'))).toBeUndefined()
  })

  it('is the linked worktree’s directory name, from any subdirectory', () => {
    expect(worktreeSlug(join(dir, 'task-392-stop-hook'))).toBe('task-392-stop-hook')
  })

  it('is undefined outside any git repository', () => {
    expect(worktreeSlug(tmpdir())).toBeUndefined()
  })
})

describe('resolveTestDatabaseUrl', () => {
  it('lets TEST_DATABASE_URL win over any derivation', () => {
    const explicit = 'postgres://kumite:kumite@localhost:5487/mine'
    expect(resolveTestDatabaseUrl({ TEST_DATABASE_URL: explicit, DATABASE_URL: BASE }, {})).toBe(
      explicit,
    )
  })

  it('derives from DATABASE_URL, then from back/.env, then from the 5433 default', () => {
    expect(
      resolveTestDatabaseUrl(
        { DATABASE_URL: BASE },
        { DATABASE_URL: 'postgres://x:y@localhost:1/ignored' },
        'wt',
      ),
    ).toBe('postgres://kumite:kumite@localhost:5487/kumite_test_wt')
    expect(
      resolveTestDatabaseUrl({}, { DATABASE_URL: 'postgres://a:b@localhost:5440/other' }),
    ).toBe('postgres://a:b@localhost:5440/other_test')
    expect(resolveTestDatabaseUrl({}, {})).toBe(
      'postgres://kumite:kumite@localhost:5433/kumite_test',
    )
  })

  it('treats a blank DATABASE_URL as unset', () => {
    expect(resolveTestDatabaseUrl({ DATABASE_URL: '' }, {})).toBe(
      'postgres://kumite:kumite@localhost:5433/kumite_test',
    )
  })
})

describe('the suite itself (#392 regression)', () => {
  it('never runs against the base database: its DATABASE_URL is a *_test one', () => {
    if (process.env['TEST_DATABASE_URL']) return
    const name = databaseName(process.env['DATABASE_URL'] ?? '')
    expect(name).toMatch(/_test(_[a-z0-9_]+)?$/)
  })

  it('names this very tree: the slug of a linked worktree, none in the main checkout', () => {
    if (process.env['TEST_DATABASE_URL']) return
    const slug = worktreeSlug(process.cwd())
    const name = databaseName(process.env['DATABASE_URL'] ?? '')
    if (slug === undefined) expect(name).toMatch(/_test$/)
    else expect(name).toContain('_test_')
  })
})

describe('resolveDatabaseUrl', () => {
  it('prefers the real environment over back/.env, like process.loadEnvFile()', () => {
    expect(
      resolveDatabaseUrl({ DATABASE_URL: BASE }, { DATABASE_URL: 'postgres://x@localhost/y' }),
    ).toBe(BASE)
    expect(resolveDatabaseUrl({}, { DATABASE_URL: BASE })).toBe(BASE)
    expect(resolveDatabaseUrl({}, {})).toBe('postgres://kumite:kumite@localhost:5433/kumite')
  })
})

describe('ensureDatabase (db:create and the globalSetup)', () => {
  it('creates a missing database once, then reports it as existing', async () => {
    const probe = new URL(process.env['DATABASE_URL'] ?? '')
    probe.pathname = `${probe.pathname}_probe`
    const name = decodeURIComponent(probe.pathname.slice(1))
    const admin = new URL(probe)
    admin.pathname = '/postgres'
    const sql = postgres(admin.toString(), { max: 1, onnotice: () => {} })
    try {
      await sql.unsafe(`drop database if exists "${name}"`)
      expect(await ensureDatabase(probe.toString())).toBe('created')
      expect(await ensureDatabase(probe.toString())).toBe('existed')
      const rows = await sql`select 1 from pg_database where datname = ${name}`
      expect(rows).toHaveLength(1)
    } finally {
      await sql.unsafe(`drop database if exists "${name}"`)
      await sql.end()
    }
    // create/drop database fsyncs a whole template copy: seconds on WSL.
  }, 30_000)
})
