import postgres from 'postgres'
import { describe, expect, it } from 'vitest'

import { ensureDatabase } from './test-database'
import { dropDatabases, mainDatabaseUrl, worktreeDatabaseCandidates } from './worktree-databases'

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
  })

  it('leaves a worktree database on another server alone', () => {
    const urls = worktreeDatabaseCandidates({
      mainUrl: MAIN,
      worktreeUrl: 'postgres://kumite:kumite@localhost:5440/kumite',
      dir: 'task-7-docker',
    })
    expect(names(urls)).toEqual(['kumite_test_task_7_docker'])
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
  it('reports on a dry run, drops for real, skips what does not exist', async () => {
    const base = process.env['DATABASE_URL'] ?? ''
    const probe = new URL(base)
    probe.pathname = `${probe.pathname}_dropprobe`
    const name = decodeURIComponent(probe.pathname.slice(1))
    const missing = new URL(base)
    missing.pathname = `${missing.pathname}_dropprobe_missing`
    const admin = new URL(base)
    admin.pathname = '/postgres'
    const sql = postgres(admin.toString(), { max: 1, onnotice: () => {} })
    const exists = async () =>
      (await sql`select 1 from pg_database where datname = ${name}`).length === 1
    const lines: string[] = []
    try {
      await ensureDatabase(probe.toString())
      const urls = [probe.toString(), missing.toString()]

      expect(await dropDatabases(base, urls, true, (l) => lines.push(l))).toEqual([name])
      expect(await exists()).toBe(true)

      expect(await dropDatabases(base, urls, false, (l) => lines.push(l))).toEqual([name])
      expect(await exists()).toBe(false)
      expect(lines).toEqual([`would drop database ${name}`, `dropped database ${name}`])
    } finally {
      await sql.unsafe(`drop database if exists "${name}"`)
      await sql.end()
    }
    // create/drop database fsyncs a whole template copy: seconds on WSL.
  }, 30_000)

  it('refuses a server that is not local', async () => {
    await expect(
      dropDatabases('postgres://kumite:kumite@db.example.com:5432/kumite', [], true),
    ).rejects.toThrow(/refuses/)
  })
})
