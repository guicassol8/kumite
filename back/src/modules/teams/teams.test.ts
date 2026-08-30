import { sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { createDb } from '../../db/client'
import { eventConfigTable, teamMembersTable, teamsTable, usersTable } from '../../db/schema'

// Runs against the real dockerized Postgres (docker compose up -d) — the
// #30 migration must already be applied.
const db = createDb()

beforeEach(async () => {
  await db.execute(
    sql`truncate table ${teamMembersTable}, ${teamsTable}, ${eventConfigTable}, ${usersTable} restart identity cascade`,
  )
})

afterAll(async () => {
  await db.$client.end()
})

describe('teams table', () => {
  it('rejects a second team whose name differs only by case', async () => {
    await db.insert(teamsTable).values({ name: 'Blockly Busters' })

    await expect(db.insert(teamsTable).values({ name: 'blockly busters' })).rejects.toThrow()
  })
})

describe('team_members table', () => {
  it('rejects a user joining a second team', async () => {
    const [user] = await db
      .insert(usersTable)
      .values({
        email: 'ada@example.com',
        passwordHash: 'hash',
        role: 'participant',
        university: 'pucrs',
      })
      .returning()
    const [teamA] = await db.insert(teamsTable).values({ name: 'Team A' }).returning()
    const [teamB] = await db.insert(teamsTable).values({ name: 'Team B' }).returning()
    if (!user || !teamA || !teamB) throw new Error('expected fixtures')

    await db.insert(teamMembersTable).values({ userId: user.id, teamId: teamA.id })

    await expect(
      db.insert(teamMembersTable).values({ userId: user.id, teamId: teamB.id }),
    ).rejects.toThrow()
  })
})

describe('event_config table', () => {
  it('rejects an insert whose id is not 1', async () => {
    await expect(db.insert(eventConfigTable).values({ id: 2 })).rejects.toThrow()
  })

  it('defaults to free mixing and a max team size of 3', async () => {
    const [config] = await db.insert(eventConfigTable).values({ id: 1 }).returning()

    expect(config?.mixingLocked).toBe(false)
    expect(config?.maxTeamSize).toBe(3)
  })
})
