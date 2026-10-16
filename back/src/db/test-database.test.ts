import { execFileSync } from 'node:child_process'
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  createStatement,
  ensureDatabase,
  gitDiscoveryEnv,
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

/** Runs `fn` with `vars` set in process.env, then puts back what was there. */
function withEnv<T>(vars: Record<string, string>, fn: () => T): T {
  const saved = Object.fromEntries(Object.keys(vars).map((key) => [key, process.env[key]]))
  Object.assign(process.env, vars)
  try {
    return fn()
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

describe('gitDiscoveryEnv', () => {
  it('drops every variable that pins git to a repository, and nothing else (#407)', () => {
    const pinning = {
      GIT_DIR: '/r/.git/worktrees/w',
      GIT_WORK_TREE: '/r',
      GIT_INDEX_FILE: '/r/.git/index',
      GIT_COMMON_DIR: '/r/.git',
      GIT_OBJECT_DIRECTORY: '/r/.git/objects',
      GIT_ALTERNATE_OBJECT_DIRECTORIES: '/q/objects',
      GIT_PREFIX: 'back/',
    }
    // GIT_EXEC_PATH is git's own install, exported to every hook: no repository.
    const kept = { PATH: '/usr/bin', HOME: '/home/x', GIT_EXEC_PATH: '/usr/lib/git-core' }
    const env = { ...pinning, ...kept }
    expect(gitDiscoveryEnv(env)).toEqual(kept)
    expect(env).toEqual({ ...pinning, ...kept })
  })
})

describe('worktreeSlug', () => {
  let dir: string
  // gitDiscoveryEnv (#407): with an inherited GIT_DIR, this fixture's init,
  // commit and worktree add would write into that repository instead.
  const git = (cwd: string, ...args: string[]) =>
    execFileSync('git', args, { cwd, env: gitDiscoveryEnv(), encoding: 'utf8' }).trim()
  const commit = (cwd: string, ...args: string[]) =>
    git(cwd, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', ...args)

  beforeAll(() => {
    dir = realpathSync(mkdtempSync(join(tmpdir(), 'kumite-392-')))
    // The fixture is built the way the pre-push ladder of a linked worktree
    // would build it: with git's hook variables inherited (GIT_DIR on a
    // pre-push, GIT_INDEX_FILE too on a pre-commit). They point at `decoy`,
    // standing in for the real repository.
    git(dir, 'init', '-q', 'decoy')
    commit(join(dir, 'decoy'), '--allow-empty', '-m', 'decoy')
    git(join(dir, 'decoy'), 'worktree', 'add', '-q', join(dir, 'decoy-wt'))
    const hookGitDir = join(dir, 'decoy', '.git', 'worktrees', 'decoy-wt')
    withEnv({ GIT_DIR: hookGitDir, GIT_INDEX_FILE: join(hookGitDir, 'index') }, () => {
      git(dir, 'init', '-q', 'main')
      writeFileSync(join(dir, 'main', 'f'), 'x')
      git(join(dir, 'main'), 'add', 'f')
      commit(join(dir, 'main'), '-m', 'init')
      git(join(dir, 'main'), 'worktree', 'add', '-q', join(dir, 'task-392-stop-hook'))
    })
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

  it('built that fixture without writing into the repository a hook points at (#407)', () => {
    expect(git(join(dir, 'main'), 'rev-parse', '--absolute-git-dir')).toBe(
      join(dir, 'main', '.git'),
    )
    const decoy = join(dir, 'decoy')
    expect(git(decoy, 'rev-list', '--all', '--count')).toBe('1')
    expect(git(decoy, 'worktree', 'list', '--porcelain').match(/^worktree /gm)).toHaveLength(2)
  })

  // #407: git exports its repository variables to hooks. Inherited by the
  // suite (the pre-push ladder), they made git answer about *that* repository
  // from any directory. Here they point at this fixture, never at the real
  // repository.
  it.each([
    {
      // What a pre-push from a linked worktree gets: the #401 failure.
      shape: 'a pre-push from a linked worktree',
      vars: (d: string) => ({
        GIT_DIR: join(d, 'main', '.git', 'worktrees', 'task-392-stop-hook'),
      }),
    },
    {
      shape: 'git --git-dir --work-tree, with an index',
      vars: (d: string) => ({
        GIT_DIR: join(d, 'main', '.git'),
        GIT_WORK_TREE: join(d, 'main'),
        GIT_INDEX_FILE: join(d, 'main', '.git', 'index'),
      }),
    },
  ])('ignores the variables git exports to $shape (#407)', ({ vars }) => {
    withEnv(vars(dir), () => {
      expect(worktreeSlug(join(dir, 'main'))).toBeUndefined()
      expect(worktreeSlug(join(dir, 'task-392-stop-hook'))).toBe('task-392-stop-hook')
      expect(worktreeSlug(tmpdir())).toBeUndefined()
    })
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
  // No real CREATE/DROP DATABASE here (#453): a DROP forces an immediate
  // checkpoint, and with two other suites on the machine one took minutes on
  // WSL and timed this test out — the failure dropDatabases hit first (#404).
  // The SELECT on pg_database stays real; the create statement is recorded
  // instead of run. The real create is proven by the globalSetup (it creates
  // a worktree's suite database on its first run) and by hand in the PR.
  const base = process.env['DATABASE_URL'] ?? ''
  const absent = new URL(base)
  absent.pathname = `${absent.pathname}_absent_453`
  const absentName = databaseName(absent.toString())
  const noWait = async () => {}

  function pgError(code: string): Error {
    return Object.assign(new Error(`pg ${code}`), { code })
  }

  async function exists(name: string): Promise<boolean> {
    const admin = new URL(base)
    admin.pathname = '/postgres'
    const sql = postgres(admin.toString(), { max: 1, onnotice: () => {} })
    try {
      const rows = await sql`select 1 from pg_database where datname = ${name}`
      return rows.length > 0
    } finally {
      await sql.end()
    }
  }

  it('reports the suite’s own database as existing and runs nothing', async () => {
    const ran: string[] = []
    expect(await ensureDatabase(base, async (s) => ran.push(s))).toBe('existed')
    expect(ran).toEqual([])
  })

  it('issues the create statement for a missing database, through execute only', async () => {
    expect(await exists(absentName)).toBe(false)
    const ran: string[] = []
    expect(await ensureDatabase(absent.toString(), async (s) => ran.push(s))).toBe('created')
    expect(ran).toEqual([createStatement(absentName)])
    // The recorder ran it, not the server: the database is still absent.
    expect(await exists(absentName)).toBe(false)
  })

  it('counts a concurrent creator’s 42P04 duplicate_database as existing', async () => {
    const execute = async () => {
      throw pgError('42P04')
    }
    expect(await ensureDatabase(absent.toString(), execute, noWait)).toBe('existed')
  })

  it('retries a busy template (55006), then creates', async () => {
    const ran: string[] = []
    const execute = async (statement: string) => {
      ran.push(statement)
      if (ran.length === 1) throw pgError('55006')
    }
    expect(await ensureDatabase(absent.toString(), execute, noWait)).toBe('created')
    expect(ran).toEqual([createStatement(absentName), createStatement(absentName)])
  })

  it('gives up after 6 attempts on a template that stays busy', async () => {
    let calls = 0
    const waits: number[] = []
    const execute = async () => {
      calls++
      throw pgError('55006')
    }
    const wait = async (ms: number) => {
      waits.push(ms)
    }
    await expect(ensureDatabase(absent.toString(), execute, wait)).rejects.toMatchObject({
      code: '55006',
    })
    expect(calls).toBe(6)
    expect(waits).toEqual([200, 400, 600, 800, 1000])
  })

  it('rethrows any other error', async () => {
    const execute = async () => {
      throw pgError('42501')
    }
    await expect(ensureDatabase(absent.toString(), execute, noWait)).rejects.toMatchObject({
      code: '42501',
    })
  })

  it('quotes the name in the create statement', () => {
    expect(createStatement('a"b')).toBe('create database "a""b"')
  })
})
