import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { createDb } from '../../db/client'
import { eventConfigTable, teamMembersTable, teamsTable, usersTable } from '../../db/schema'
import type { University } from '../users/users.schema'

import { createTeam, joinTeam, leaveTeam, listTeams } from './teams.service'

// Runs against the real dockerized Postgres (docker compose up -d) — the
// #30 migration must already be applied.
const db = createDb()

let userSeq = 0
async function insertUser(university: University = 'pucrs') {
  userSeq += 1
  const [user] = await db
    .insert(usersTable)
    .values({
      email: `user-${userSeq}@example.com`,
      passwordHash: 'hash',
      role: 'participant',
      university,
    })
    .returning()
  if (!user) throw new Error('expected user to be inserted')
  return user
}

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

describe('createTeam', () => {
  it('creates the team with the creator already a member', async () => {
    const creator = await insertUser()

    const result = await createTeam(db, creator.id, 'Blockly Busters')

    expect(result).toMatchObject({ ok: true, team: { name: 'Blockly Busters' } })
    if (!result.ok) throw new Error('expected success')
    const [membership] = await db
      .select()
      .from(teamMembersTable)
      .where(eq(teamMembersTable.teamId, result.team.id))
    expect(membership?.userId).toBe(creator.id)
  })

  it('rejects a creator who already belongs to a team', async () => {
    const creator = await insertUser()
    await createTeam(db, creator.id, 'Team A')

    const result = await createTeam(db, creator.id, 'Team B')

    expect(result).toEqual({ ok: false, error: 'already_in_team' })
  })

  it('rejects a name that collides case-insensitively', async () => {
    const creatorA = await insertUser()
    const creatorB = await insertUser()
    await createTeam(db, creatorA.id, 'Blockly Busters')

    const result = await createTeam(db, creatorB.id, 'blockly busters')

    expect(result).toEqual({ ok: false, error: 'name_taken' })
  })
})

describe('joinTeam', () => {
  it('adds the joiner as a member', async () => {
    const creator = await insertUser()
    const joiner = await insertUser()
    const created = await createTeam(db, creator.id, 'Team A')
    if (!created.ok) throw new Error('expected success')

    const result = await joinTeam(db, joiner.id, created.team.id)

    expect(result).toEqual({ ok: true, team: created.team })
    const [membership] = await db
      .select()
      .from(teamMembersTable)
      .where(eq(teamMembersTable.userId, joiner.id))
    expect(membership?.teamId).toBe(created.team.id)
  })

  it('rejects a joiner who already belongs to a team', async () => {
    const creatorA = await insertUser()
    const creatorB = await insertUser()
    const teamA = await createTeam(db, creatorA.id, 'Team A')
    const teamB = await createTeam(db, creatorB.id, 'Team B')
    if (!teamA.ok || !teamB.ok) throw new Error('expected success')

    const result = await joinTeam(db, creatorA.id, teamB.team.id)

    expect(result).toEqual({ ok: false, error: 'already_in_team' })
  })

  it('rejects an unknown team id', async () => {
    const joiner = await insertUser()

    const result = await joinTeam(db, joiner.id, '00000000-0000-0000-0000-000000000000')

    expect(result).toEqual({ ok: false, error: 'not_found' })
  })

  it('rejects a join that would exceed the configured max team size', async () => {
    await db.insert(eventConfigTable).values({ id: 1, maxTeamSize: 1 })
    const creator = await insertUser()
    const joiner = await insertUser()
    const created = await createTeam(db, creator.id, 'Team A')
    if (!created.ok) throw new Error('expected success')

    const result = await joinTeam(db, joiner.id, created.team.id)

    expect(result).toEqual({ ok: false, error: 'team_full' })
  })

  it('allows a cross-university join when mixing is unlocked', async () => {
    const creator = await insertUser('pucrs')
    const joiner = await insertUser('merida')
    const created = await createTeam(db, creator.id, 'Team A')
    if (!created.ok) throw new Error('expected success')

    const result = await joinTeam(db, joiner.id, created.team.id)

    expect(result.ok).toBe(true)
  })

  // No route sets mixingLocked yet (deferred to the Painel epic per #30's
  // Contexto) — proven here via a direct write, not reachable over .hurl.
  it('rejects a cross-university join when mixing is locked', async () => {
    await db.insert(eventConfigTable).values({ id: 1, mixingLocked: true })
    const creator = await insertUser('pucrs')
    const joiner = await insertUser('merida')
    const created = await createTeam(db, creator.id, 'Team A')
    if (!created.ok) throw new Error('expected success')

    const result = await joinTeam(db, joiner.id, created.team.id)

    expect(result).toEqual({ ok: false, error: 'mixed_lock_violation' })
  })

  it('allows a same-university join when mixing is locked', async () => {
    await db.insert(eventConfigTable).values({ id: 1, mixingLocked: true })
    const creator = await insertUser('pucrs')
    const joiner = await insertUser('pucrs')
    const created = await createTeam(db, creator.id, 'Team A')
    if (!created.ok) throw new Error('expected success')

    const result = await joinTeam(db, joiner.id, created.team.id)

    expect(result.ok).toBe(true)
  })
})

describe('leaveTeam', () => {
  it('removes the membership when the team has no submissions', async () => {
    const creator = await insertUser()
    const created = await createTeam(db, creator.id, 'Team A')
    if (!created.ok) throw new Error('expected success')

    const result = await leaveTeam(db, creator.id)

    expect(result).toEqual({ ok: true })
    const [membership] = await db
      .select()
      .from(teamMembersTable)
      .where(eq(teamMembersTable.userId, creator.id))
    expect(membership).toBeUndefined()
  })

  it('rejects a user with no team', async () => {
    const user = await insertUser()

    const result = await leaveTeam(db, user.id)

    expect(result).toEqual({ ok: false, error: 'not_in_team' })
  })

  // No route sets firstSubmittedAt yet (owned by #31 until #18/#21 land a
  // real submissions table) — proven here via a direct write.
  it('rejects leaving a team that has already submitted', async () => {
    const creator = await insertUser()
    const created = await createTeam(db, creator.id, 'Team A')
    if (!created.ok) throw new Error('expected success')
    await db
      .update(teamsTable)
      .set({ firstSubmittedAt: new Date() })
      .where(eq(teamsTable.id, created.team.id))

    const result = await leaveTeam(db, creator.id)

    expect(result).toEqual({ ok: false, error: 'team_frozen' })
    const [membership] = await db
      .select()
      .from(teamMembersTable)
      .where(eq(teamMembersTable.userId, creator.id))
    expect(membership).toBeDefined()
  })
})

describe('listTeams', () => {
  it('lists teams with member universities and slots available', async () => {
    await db.insert(eventConfigTable).values({ id: 1, maxTeamSize: 3 })
    const creator = await insertUser('pucrs')
    const joiner = await insertUser('merida')
    const created = await createTeam(db, creator.id, 'Team A')
    if (!created.ok) throw new Error('expected success')
    await joinTeam(db, joiner.id, created.team.id)

    const teams = await listTeams(db)

    expect(teams).toEqual([
      {
        id: created.team.id,
        name: 'Team A',
        members: expect.arrayContaining([{ university: 'pucrs' }, { university: 'merida' }]),
        maxTeamSize: 3,
        slotsAvailable: 1,
      },
    ])
  })

  it('returns an empty list when no teams exist', async () => {
    const teams = await listTeams(db)

    expect(teams).toEqual([])
  })
})
