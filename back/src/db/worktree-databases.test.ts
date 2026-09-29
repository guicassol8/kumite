import { describe, expect, it } from 'vitest'

import {
  dropDatabases,
  dropStatement,
  mainDatabaseUrl,
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
