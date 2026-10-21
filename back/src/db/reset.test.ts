import { getTableName, sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { createDb } from './client'
import { allTables, assertLocalDatabaseUrl, resetDatabase } from './reset'
import { eventConfigTable, roundsTable, teamsTable, usersTable } from './schema'

// Runs against the real dockerized Postgres (docker compose up -d), like
// seed.test.ts — the migrations must already be applied.
const db = createDb()

beforeEach(() => {
  process.env['ORGANIZER_EMAIL'] = 'organizer@example.com'
  process.env['ORGANIZER_PASSWORD'] = 'supersecret'
})

afterAll(async () => {
  await db.$client.end()
})

describe('assertLocalDatabaseUrl', () => {
  it.each([
    'postgres://kumite:kumite@localhost:5433/kumite',
    'postgres://kumite:kumite@127.0.0.1:5441/kumite_review',
    'postgres://kumite:kumite@[::1]:5432/kumite',
  ])('accepts %s', (url) => {
    expect(() => assertLocalDatabaseUrl(url)).not.toThrow()
  })

  it.each([
    // docker-compose.prod.yml: the back container reaches Postgres as `db`.
    'postgres://kumite:secret@db:5432/kumite',
    'postgres://kumite:secret@kumite.abc.sa-east-1.rds.amazonaws.com:5432/kumite',
    'postgres://kumite:secret@10.0.0.7:5432/kumite',
  ])('refuses %s', (url) => {
    expect(() => assertLocalDatabaseUrl(url)).toThrow(/refuses to run against/)
  })

  it('names a value it cannot parse instead of throwing a TypeError', () => {
    expect(() => assertLocalDatabaseUrl('not a url')).toThrow(/not a URL/)
  })
})

describe('allTables', () => {
  it('matches every table in the live public schema, so a new table cannot be missed', async () => {
    // information_schema, not a hand-written list: a table added to
    // db/schema.ts without reaching this module would show up here as a
    // mismatch, and so would one created by a migration and never modelled.
    const rows = (await db.execute(
      sql`select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'`,
    )) as unknown as { table_name: string }[]
    const inDatabase = rows.map((row) => row.table_name).sort()
    expect(allTables().map(getTableName).sort()).toEqual(inDatabase)
    expect(inDatabase).toContain('submissions')
    expect(inDatabase).toContain('event_config')
  })
})

describe('resetDatabase', () => {
  it('empties every table and leaves the state of a fresh seed', async () => {
    // Dirty the database the way a vitest + hurl run does: extra rows in
    // tables the seed never touches, and a mutated singleton.
    await db.insert(teamsTable).values({ name: 'Time fantasma' })
    await db.insert(roundsTable).values({ name: 'Rodada velha', durationMinutes: 30 })
    await db
      .insert(eventConfigTable)
      .values({ id: 1, mixingLocked: true, maxTeamSize: 6 })
      .onConflictDoUpdate({
        target: eventConfigTable.id,
        set: { mixingLocked: true, maxTeamSize: 6 },
      })

    await resetDatabase(db)

    expect(await db.select().from(teamsTable)).toHaveLength(0)
    expect(await db.select().from(roundsTable)).toHaveLength(0)
    const users = await db.select().from(usersTable)
    expect(users).toHaveLength(1)
    expect(users[0]?.role).toBe('organizer')
    const [config] = await db.select().from(eventConfigTable)
    expect(config?.mixingLocked).toBe(false)
    expect(config?.maxTeamSize).toBe(3)
  })

  it('can run twice in a row', async () => {
    await resetDatabase(db)
    await resetDatabase(db)
    expect(await db.select().from(usersTable)).toHaveLength(1)
    const [{ count }] = (await db.execute(
      sql`select count(*)::int as count from problems`,
    )) as unknown as [{ count: number }]
    // 11 competition (#483) + 3 practice problems (#210).
    expect(count).toBe(14)
  })
})
