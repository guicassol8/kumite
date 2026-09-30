import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  dropDatabases,
  dropStatement,
  mainDatabaseUrl,
  otherWorktreeUrls,
  redact,
  worktreeDatabaseCandidates,
  worktreeDir,
} from './worktree-databases'

const MAIN = 'postgres://kumite:kumite@localhost:5487/kumite'
const names = (urls: string[]) =>
  urls.map((url) => decodeURIComponent(new URL(url).pathname.slice(1)))

describe('worktreeDatabaseCandidates (#395)', () => {
  it('names the suite database of the worktree, and its own E2E database', () => {
    const urls = worktreeDatabaseCandidates({
      mainUrl: MAIN,
      worktreeUrl: 'postgres://kumite:kumite@localhost:5487/kumite_task404',
      dir: 'task-404-parallel-batch',
    })
    expect(names(urls)).toEqual([
      'kumite_test_task_404_parallel_batch',
      'kumite_task404',
      'kumite_task404_test_task_404_parallel_batch',
    ])
  })

  it('is only the suite database when the worktree shares the main database', () => {
    const urls = worktreeDatabaseCandidates({ mainUrl: MAIN, worktreeUrl: MAIN, dir: 'review-405' })
    expect(names(urls)).toEqual(['kumite_test_review_405'])
  })

  it('never names the main database, its _test, or any exported base', () => {
    const urls = worktreeDatabaseCandidates({
      mainUrl: MAIN,
      otherBases: ['postgres://kumite:kumite@localhost:5487/kumite_task200'],
      worktreeUrl: 'postgres://kumite:kumite@localhost:5487/kumite_test',
      dir: 'task-9-x',
    })
    expect(names(urls)).not.toContain('kumite')
    expect(names(urls)).not.toContain('kumite_test')
    expect(names(urls)).not.toContain('kumite_task200')
    expect(names(urls)).toContain('kumite_task200_test_task_9_x')
    // An exported base is protected even when the worktree's own back/.env
    // names it: a shell that exports it may be serving it right now.
    const own = worktreeDatabaseCandidates({
      mainUrl: MAIN,
      otherBases: ['postgres://kumite:kumite@localhost:5487/kumite_task200'],
      worktreeUrl: 'postgres://kumite:kumite@localhost:5487/kumite_task200',
      dir: 'task-9-x',
    })
    expect(names(own)).toEqual(['kumite_test_task_9_x', 'kumite_task200_test_task_9_x'])
  })

  it('leaves a worktree database on another server alone', () => {
    const urls = worktreeDatabaseCandidates({
      mainUrl: MAIN,
      worktreeUrl: 'postgres://kumite:kumite@localhost:5440/kumite_task7',
      dir: 'task-7-docker',
    })
    expect(names(urls)).toEqual(['kumite_test_task_7_docker'])
  })

  it('never names a database another worktree still uses', () => {
    const urls = worktreeDatabaseCandidates({
      mainUrl: MAIN,
      worktreeUrl: 'postgres://kumite:kumite@localhost:5487/kumite_task404',
      dir: 'task-404-copy',
      keep: [MAIN, 'postgres://kumite:kumite@localhost:5487/kumite_task404', undefined],
    })
    expect(names(urls)).toEqual(['kumite_test_task_404_copy', 'kumite_task404_test_task_404_copy'])
  })
})

describe('worktreeDatabaseCandidates with a URL that does not parse', () => {
  // `${DB_PORT}` is not expanded by parseEnv: another tree's back/.env can hold
  // it. It must neither crash the drop of every other worktree nor print that
  // tree's password (a TypeError from `new URL` carries its input).
  const BAD = 'postgres://kumite:s3cret@localhost:${DB_PORT}/kumite_x'

  it('still protects the database another worktree names, by its last path segment', () => {
    const urls = worktreeDatabaseCandidates({
      mainUrl: MAIN,
      worktreeUrl: 'postgres://kumite:kumite@localhost:5487/kumite_x',
      dir: 'task-8-y',
      keep: [BAD],
    })
    expect(names(urls)).toEqual(['kumite_test_task_8_y', 'kumite_x_test_task_8_y'])
  })

  it('skips an unparsable base or worktree URL instead of throwing', () => {
    const urls = worktreeDatabaseCandidates({
      mainUrl: MAIN,
      otherBases: [BAD],
      worktreeUrl: BAD,
      dir: 'task-8-y',
    })
    expect(names(urls)).toEqual(['kumite_test_task_8_y'])
  })

  it('names nothing when the main URL does not parse', () => {
    expect(worktreeDatabaseCandidates({ mainUrl: BAD, dir: 'task-8-y' })).toEqual([])
  })

  it('redacts the credentials of any URL in an error text', () => {
    expect(redact(`Invalid URL: ${BAD} and postgres://u:p@h/d`)).toBe(
      'Invalid URL: postgres://***@localhost:${DB_PORT}/kumite_x and postgres://***@h/d',
    )
  })
})

describe('otherWorktreeUrls', () => {
  it('reads every other worktree, never the one being removed — however it is spelled', () => {
    const root = mkdtempSync(join(tmpdir(), 'kumite-wt-'))
    try {
      for (const tree of ['main', 'a', 'b']) {
        mkdirSync(join(root, tree, 'back'), { recursive: true })
        writeFileSync(join(root, tree, 'back', '.env'), `DATABASE_URL=postgres://h/${tree}_db\n`)
      }
      symlinkSync(join(root, 'a'), join(root, 'link-to-a'))
      const trees = ['main', 'a', 'b'].map((tree) => join(root, tree))
      const dbs = (urls: (string | undefined)[]) => urls.map((url) => url?.split('/').pop())
      expect(dbs(otherWorktreeUrls(trees, join(root, 'a')))).toEqual(['main_db', 'b_db'])
      expect(dbs(otherWorktreeUrls(trees, join(root, 'link-to-a')))).toEqual(['main_db', 'b_db'])
      expect(dbs(otherWorktreeUrls(trees, join(root, 'gone')))).toEqual(['main_db', 'a_db', 'b_db'])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('worktreeDir', () => {
  it('resolves a relative path from where pnpm was run, not from back/', () => {
    expect(worktreeDir('.worktrees/review-9', { INIT_CWD: '/repo' }, '/repo/back')).toBe(
      '/repo/.worktrees/review-9',
    )
    expect(worktreeDir('../x', {}, '/repo/back')).toBe('/repo/x')
    expect(worktreeDir('/abs/wt/', { INIT_CWD: '/repo' }, '/repo/back')).toBe('/abs/wt')
  })
})

describe('mainDatabaseUrl', () => {
  it('prefers the main back/.env over an exported DATABASE_URL, then the default', () => {
    expect(mainDatabaseUrl('/nonexistent', { DATABASE_URL: MAIN })).toBe(MAIN)
    expect(mainDatabaseUrl('/nonexistent', {})).toBe(
      'postgres://kumite:kumite@localhost:5433/kumite',
    )
  })
})

describe('dropDatabases (#395)', () => {
  // No real CREATE/DROP DATABASE here: a DROP forces an immediate checkpoint,
  // and one racing the rest of the suite on WSL took minutes and timed out
  // every database test beside it (#404). The suite's own database plays the
  // one that exists; the drop statement is recorded instead of run. The real
  // drop is proven by hand in the PR's evidence.
  const base = process.env['DATABASE_URL'] ?? ''
  const existing = decodeURIComponent(new URL(base).pathname.slice(1))
  const missing = new URL(base)
  missing.pathname = `${missing.pathname}_dropprobe_missing`
  const urls = [base, missing.toString()]

  it('reports what exists on a dry run and runs nothing', async () => {
    const lines: string[] = []
    const ran: string[] = []
    const names = await dropDatabases(
      base,
      urls,
      true,
      (l) => lines.push(l),
      async (s) => ran.push(s),
    )
    expect(names).toEqual([existing])
    expect(lines).toEqual([`would drop database ${existing}`])
    expect(ran).toEqual([])
  })

  it('drops what exists for real, and skips what does not', async () => {
    const lines: string[] = []
    const ran: string[] = []
    const names = await dropDatabases(
      base,
      urls,
      false,
      (l) => lines.push(l),
      async (s) => ran.push(s),
    )
    expect(names).toEqual([existing])
    expect(ran).toEqual([dropStatement(existing)])
    expect(lines).toEqual([`dropped database ${existing}`])
  })

  it('quotes the name and forces out leftover sessions', () => {
    expect(dropStatement('kumite_task404')).toBe(
      'drop database if exists "kumite_task404" with (force)',
    )
    expect(dropStatement('a"b')).toBe('drop database if exists "a""b" with (force)')
  })

  it('refuses a server that is not local', async () => {
    await expect(
      dropDatabases('postgres://kumite:kumite@db.example.com:5432/kumite', [], true),
    ).rejects.toThrow(/refuses/)
  })
})
