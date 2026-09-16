import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { createDb } from '../../db/client'
import {
  eventConfigTable,
  problemsTable,
  roundProblemsTable,
  roundsTable,
  submissionsTable,
  teamMembersTable,
  teamsTable,
  usersTable,
} from '../../db/schema'
import { updateEventConfig } from '../event-config/event-config.service'
import type { University } from '../users/users.schema'

import {
  createTeam,
  joinTeam,
  leaveTeam,
  listOrganizerTeams,
  listTeams,
  moveMember,
  removeMember,
  removeTeam,
  renameTeam,
} from './teams.service'

// Runs against the real dockerized Postgres (docker compose up -d) — the
// #30 migration must already be applied.
const db = createDb()

let userSeq = 0
// `name: null` reproduces an account created before the #122 migration.
async function insertUser(university: University = 'pucrs', name?: string | null) {
  userSeq += 1
  const [user] = await db
    .insert(usersTable)
    .values({
      email: `user-${userSeq}@example.com`,
      name: name === undefined ? `User ${userSeq}` : name,
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
    sql`truncate table ${submissionsTable}, ${roundProblemsTable}, ${roundsTable}, ${problemsTable}, ${teamMembersTable}, ${teamsTable}, ${eventConfigTable}, ${usersTable} restart identity cascade`,
  )
})

async function insertSubmission(teamId: string, userId: string) {
  const [problem] = await db
    .insert(problemsTable)
    .values({ difficulty: 'easy', status: 'published' })
    .returning()
  if (!problem) throw new Error('expected a problem fixture')
  // Every submission belongs to a round (#176), so the fixture needs one even
  // though nothing here reads it. Closed, not open: this helper is called more
  // than once per test and rounds_single_open_idx allows a single open round.
  const [round] = await db
    .insert(roundsTable)
    .values({
      name: 'Rodada 1',
      durationMinutes: 30,
      status: 'closed',
      openedAt: new Date(),
      closedAt: new Date(),
    })
    .returning()
  if (!round) throw new Error('expected a round fixture')
  await db.insert(roundProblemsTable).values({
    roundId: round.id,
    problemId: problem.id,
    position: 0,
  })
  const [submission] = await db
    .insert(submissionsTable)
    .values({
      problemId: problem.id,
      roundId: round.id,
      teamId,
      userId,
      workspace: {},
      generatedCode: '',
      caseResults: [],
      score: 100,
      attemptNumber: 1,
    })
    .returning()
  if (!submission) throw new Error('expected a submission fixture')
  return submission
}

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

  // Achado #31: createTeam did the team insert and the member insert as two
  // separate statements, so a real failure of the second one (here, the
  // membership FK rejecting a nonexistent user) still left the team row
  // committed — memberless and permanently hoarding the name.
  it('rolls back the team insert when the membership insert fails', async () => {
    const bogusUserId = '00000000-0000-0000-0000-000000000000'

    await expect(createTeam(db, bogusUserId, 'Blockly Busters')).rejects.toThrow()

    const [orphan] = await db
      .select()
      .from(teamsTable)
      .where(eq(teamsTable.name, 'Blockly Busters'))
    expect(orphan).toBeUndefined()
    const realCreator = await insertUser()
    const result = await createTeam(db, realCreator.id, 'Blockly Busters')
    expect(result).toMatchObject({ ok: true, team: { name: 'Blockly Busters' } })
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

  // Achado #22: read-then-insert with no transaction or lock let two joiners
  // both read `members.length < maxTeamSize` before either had inserted,
  // overbooking the team past its cap. Mirrors the `Promise.all` burst pattern
  // in password-reset.test.ts for the same class of TOCTOU bug.
  it('admits exactly one joiner in a race for the last slot', async () => {
    await db.insert(eventConfigTable).values({ id: 1, maxTeamSize: 2 })
    const creator = await insertUser()
    const created = await createTeam(db, creator.id, 'Team A')
    if (!created.ok) throw new Error('expected success')
    const joinerA = await insertUser()
    const joinerB = await insertUser()

    const results = await Promise.all([
      joinTeam(db, joinerA.id, created.team.id),
      joinTeam(db, joinerB.id, created.team.id),
    ])

    expect(results.filter((result) => result.ok)).toHaveLength(1)
    expect(results.filter((result) => !result.ok)).toEqual([{ ok: false, error: 'team_full' }])
    const members = await db
      .select()
      .from(teamMembersTable)
      .where(eq(teamMembersTable.teamId, created.team.id))
    expect(members).toHaveLength(2)
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

describe('renameTeam', () => {
  it('renames an active team', async () => {
    const creator = await insertUser()
    const created = await createTeam(db, creator.id, 'Team A')
    if (!created.ok) throw new Error('expected success')

    const result = await renameTeam(db, created.team.id, 'Team B')

    expect(result).toMatchObject({ ok: true, team: { name: 'Team B' } })
  })

  it('renames a frozen team without requiring it to be unfrozen', async () => {
    const creator = await insertUser()
    const created = await createTeam(db, creator.id, 'Team A')
    if (!created.ok) throw new Error('expected success')
    await db
      .update(teamsTable)
      .set({ firstSubmittedAt: new Date() })
      .where(eq(teamsTable.id, created.team.id))

    const result = await renameTeam(db, created.team.id, 'Team B')

    expect(result).toMatchObject({ ok: true, team: { name: 'Team B' } })
  })

  it('rejects an unknown team id', async () => {
    const result = await renameTeam(db, '00000000-0000-0000-0000-000000000000', 'Team B')

    expect(result).toEqual({ ok: false, error: 'not_found' })
  })

  it('rejects a removed team id', async () => {
    const creator = await insertUser()
    const created = await createTeam(db, creator.id, 'Team A')
    if (!created.ok) throw new Error('expected success')
    await db
      .update(teamsTable)
      .set({ removedAt: new Date() })
      .where(eq(teamsTable.id, created.team.id))

    const result = await renameTeam(db, created.team.id, 'Team B')

    expect(result).toEqual({ ok: false, error: 'not_found' })
  })

  it('rejects a name colliding case-insensitively with another active team', async () => {
    const creatorA = await insertUser()
    const creatorB = await insertUser()
    const teamA = await createTeam(db, creatorA.id, 'Team A')
    const teamB = await createTeam(db, creatorB.id, 'Team B')
    if (!teamA.ok || !teamB.ok) throw new Error('expected success')

    const result = await renameTeam(db, teamA.team.id, 'team b')

    expect(result).toEqual({ ok: false, error: 'name_taken' })
  })

  it('allows renaming to a name that collided only with a removed team', async () => {
    const creatorA = await insertUser()
    const creatorB = await insertUser()
    const teamA = await createTeam(db, creatorA.id, 'Team A')
    const teamB = await createTeam(db, creatorB.id, 'Team B')
    if (!teamA.ok || !teamB.ok) throw new Error('expected success')
    await db
      .update(teamsTable)
      .set({ removedAt: new Date() })
      .where(eq(teamsTable.id, teamB.team.id))

    const result = await renameTeam(db, teamA.team.id, 'Team B')

    expect(result).toMatchObject({ ok: true, team: { name: 'Team B' } })
  })
})

describe('moveMember', () => {
  it('moves a member between two active teams', async () => {
    const creatorA = await insertUser()
    const memberB = await insertUser()
    const teamA = await createTeam(db, creatorA.id, 'Team A')
    const teamB = await createTeam(db, memberB.id, 'Team B')
    if (!teamA.ok || !teamB.ok) throw new Error('expected success')

    const result = await moveMember(db, memberB.id, teamA.team.id)

    expect(result).toEqual({ ok: true })
    const [membership] = await db
      .select()
      .from(teamMembersTable)
      .where(eq(teamMembersTable.userId, memberB.id))
    expect(membership?.teamId).toBe(teamA.team.id)
  })

  it('moves a member out of a frozen source team', async () => {
    const creatorA = await insertUser()
    const memberB = await insertUser()
    const teamA = await createTeam(db, creatorA.id, 'Team A')
    const teamB = await createTeam(db, memberB.id, 'Team B')
    if (!teamA.ok || !teamB.ok) throw new Error('expected success')
    await db
      .update(teamsTable)
      .set({ firstSubmittedAt: new Date() })
      .where(eq(teamsTable.id, teamB.team.id))

    const result = await moveMember(db, memberB.id, teamA.team.id)

    expect(result).toEqual({ ok: true })
  })

  it('moves a member into a frozen destination team', async () => {
    const creatorA = await insertUser()
    const memberB = await insertUser()
    const teamA = await createTeam(db, creatorA.id, 'Team A')
    const teamB = await createTeam(db, memberB.id, 'Team B')
    if (!teamA.ok || !teamB.ok) throw new Error('expected success')
    await db
      .update(teamsTable)
      .set({ firstSubmittedAt: new Date() })
      .where(eq(teamsTable.id, teamA.team.id))

    const result = await moveMember(db, memberB.id, teamA.team.id)

    expect(result).toEqual({ ok: true })
  })

  it('rejects a user with no team', async () => {
    const creator = await insertUser()
    const teamless = await insertUser()
    const team = await createTeam(db, creator.id, 'Team A')
    if (!team.ok) throw new Error('expected success')

    const result = await moveMember(db, teamless.id, team.team.id)

    expect(result).toEqual({ ok: false, error: 'member_not_found' })
  })

  it('rejects an unknown destination team', async () => {
    const creator = await insertUser()
    await createTeam(db, creator.id, 'Team A')

    const result = await moveMember(db, creator.id, '00000000-0000-0000-0000-000000000000')

    expect(result).toEqual({ ok: false, error: 'team_not_found' })
  })

  it('rejects a removed destination team', async () => {
    const creatorA = await insertUser()
    const creatorB = await insertUser()
    const teamA = await createTeam(db, creatorA.id, 'Team A')
    const teamB = await createTeam(db, creatorB.id, 'Team B')
    if (!teamA.ok || !teamB.ok) throw new Error('expected success')
    await db
      .update(teamsTable)
      .set({ removedAt: new Date() })
      .where(eq(teamsTable.id, teamB.team.id))

    const result = await moveMember(db, creatorA.id, teamB.team.id)

    expect(result).toEqual({ ok: false, error: 'team_not_found' })
  })

  it('rejects a move that would exceed the destination max team size', async () => {
    await db.insert(eventConfigTable).values({ id: 1, maxTeamSize: 1 })
    const creatorA = await insertUser()
    const creatorB = await insertUser()
    const teamA = await createTeam(db, creatorA.id, 'Team A')
    const teamB = await createTeam(db, creatorB.id, 'Team B')
    if (!teamA.ok || !teamB.ok) throw new Error('expected success')

    const result = await moveMember(db, creatorB.id, teamA.team.id)

    expect(result).toEqual({ ok: false, error: 'team_full' })
  })

  it('allows a cross-university move even when mixing is locked', async () => {
    await db.insert(eventConfigTable).values({ id: 1, mixingLocked: true })
    const creatorA = await insertUser('pucrs')
    const memberB = await insertUser('merida')
    const teamA = await createTeam(db, creatorA.id, 'Team A')
    const teamB = await createTeam(db, memberB.id, 'Team B')
    if (!teamA.ok || !teamB.ok) throw new Error('expected success')

    const result = await moveMember(db, memberB.id, teamA.team.id)

    expect(result).toEqual({ ok: true })
  })
})

describe('removeMember', () => {
  it('removes a member from an active team', async () => {
    const creator = await insertUser()
    const created = await createTeam(db, creator.id, 'Team A')
    if (!created.ok) throw new Error('expected success')

    const result = await removeMember(db, creator.id)

    expect(result).toEqual({ ok: true })
    const [membership] = await db
      .select()
      .from(teamMembersTable)
      .where(eq(teamMembersTable.userId, creator.id))
    expect(membership).toBeUndefined()
  })

  it('removes a member from a frozen team without error', async () => {
    const creator = await insertUser()
    const created = await createTeam(db, creator.id, 'Team A')
    if (!created.ok) throw new Error('expected success')
    await db
      .update(teamsTable)
      .set({ firstSubmittedAt: new Date() })
      .where(eq(teamsTable.id, created.team.id))

    const result = await removeMember(db, creator.id)

    expect(result).toEqual({ ok: true })
    const [membership] = await db
      .select()
      .from(teamMembersTable)
      .where(eq(teamMembersTable.userId, creator.id))
    expect(membership).toBeUndefined()
  })

  it('rejects a user with no team', async () => {
    const user = await insertUser()

    const result = await removeMember(db, user.id)

    expect(result).toEqual({ ok: false, error: 'not_found' })
  })
})

describe('removeTeam', () => {
  it('removes an active team, leaving members teamless', async () => {
    const creator = await insertUser()
    const created = await createTeam(db, creator.id, 'Team A')
    if (!created.ok) throw new Error('expected success')

    const result = await removeTeam(db, created.team.id)

    expect(result).toEqual({ ok: true })
    const [membership] = await db
      .select()
      .from(teamMembersTable)
      .where(eq(teamMembersTable.userId, creator.id))
    expect(membership).toBeUndefined()
    const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, created.team.id))
    expect(team?.removedAt).not.toBeNull()
  })

  it('removes a frozen team without touching its submissions', async () => {
    const creator = await insertUser()
    const created = await createTeam(db, creator.id, 'Team A')
    if (!created.ok) throw new Error('expected success')
    const submission = await insertSubmission(created.team.id, creator.id)
    await db
      .update(teamsTable)
      .set({ firstSubmittedAt: new Date() })
      .where(eq(teamsTable.id, created.team.id))

    const result = await removeTeam(db, created.team.id)

    expect(result).toEqual({ ok: true })
    const [preservedSubmission] = await db
      .select()
      .from(submissionsTable)
      .where(eq(submissionsTable.id, submission.id))
    expect(preservedSubmission).toBeDefined()
    expect(preservedSubmission?.teamId).toBe(created.team.id)
  })

  it('rejects an unknown or already-removed team id', async () => {
    const creator = await insertUser()
    const created = await createTeam(db, creator.id, 'Team A')
    if (!created.ok) throw new Error('expected success')
    const first = await removeTeam(db, created.team.id)
    expect(first).toEqual({ ok: true })

    const result = await removeTeam(db, created.team.id)

    expect(result).toEqual({ ok: false, error: 'not_found' })
  })

  it('removes the team from listTeams', async () => {
    const creator = await insertUser()
    const created = await createTeam(db, creator.id, 'Team A')
    if (!created.ok) throw new Error('expected success')
    const viewer = await insertUser()

    await removeTeam(db, created.team.id)
    const result = await listTeams(db, viewer.id)

    expect(result.teams).toEqual([])
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

    const result = await listTeams(db, creator.id)

    expect(result).toEqual({
      maxTeamSize: 3,
      mixingLocked: false,
      myTeamId: created.team.id,
      teams: [
        {
          id: created.team.id,
          name: 'Team A',
          members: expect.arrayContaining([
            { university: 'pucrs', email: creator.email, name: creator.name },
            { university: 'merida', email: joiner.email, name: joiner.name },
          ]),
          slotsAvailable: 1,
          frozen: false,
          joinBlockedReason: 'already_in_team',
        },
      ],
    })
  })

  it('returns an empty envelope when no teams exist', async () => {
    const viewer = await insertUser()

    const result = await listTeams(db, viewer.id)

    expect(result).toEqual({
      maxTeamSize: 3,
      mixingLocked: false,
      myTeamId: null,
      teams: [],
    })
  })

  it('exposes member emails only for the team the viewer belongs to', async () => {
    const viewer = await insertUser('pucrs')
    const stranger = await insertUser('pucrs')
    const mine = await createTeam(db, viewer.id, 'Mine')
    const theirs = await createTeam(db, stranger.id, 'Theirs')
    if (!mine.ok || !theirs.ok) throw new Error('expected success')

    const result = await listTeams(db, viewer.id)

    const myTeam = result.teams.find((team) => team.id === mine.team.id)
    const otherTeam = result.teams.find((team) => team.id === theirs.team.id)
    expect(myTeam?.members).toEqual([
      { university: 'pucrs', email: viewer.email, name: viewer.name },
    ])
    expect(otherTeam?.members).toEqual([{ university: 'pucrs', email: null, name: null }])
  })

  // The assertion that protects anonymity: a name is identity, so it has to
  // be gated exactly like the email, not leaked because it is "just a label".
  it('hides a member name from every team but the viewer own (#122)', async () => {
    const viewer = await insertUser('pucrs')
    const stranger = await insertUser('pucrs')
    const mine = await createTeam(db, viewer.id, 'Mine')
    const theirs = await createTeam(db, stranger.id, 'Theirs')
    if (!mine.ok || !theirs.ok) throw new Error('expected success')

    const result = await listTeams(db, viewer.id)

    const otherTeam = result.teams.find((team) => team.id === theirs.team.id)
    expect(stranger.name).not.toBeNull()
    expect(otherTeam?.members).toEqual([{ university: 'pucrs', email: null, name: null }])
  })

  it('returns a null name for a own-team member that predates the column', async () => {
    const viewer = await insertUser('pucrs')
    const legacy = await insertUser('pucrs', null)
    const mine = await createTeam(db, viewer.id, 'Mine')
    if (!mine.ok) throw new Error('expected success')
    await joinTeam(db, legacy.id, mine.team.id)

    const result = await listTeams(db, viewer.id)

    expect(result.teams[0]?.members).toEqual(
      expect.arrayContaining([{ university: 'pucrs', email: legacy.email, name: null }]),
    )
  })

  it('reports myTeamId as null and no email at all for a viewer with no team', async () => {
    const viewer = await insertUser()
    const stranger = await insertUser()
    const created = await createTeam(db, stranger.id, 'Team A')
    if (!created.ok) throw new Error('expected success')

    const result = await listTeams(db, viewer.id)

    expect(result.myTeamId).toBeNull()
    expect(result.teams[0]?.members).toEqual([{ university: 'pucrs', email: null, name: null }])
  })

  it('marks a team that has already submitted as frozen', async () => {
    const creator = await insertUser()
    const created = await createTeam(db, creator.id, 'Team A')
    if (!created.ok) throw new Error('expected success')
    await db
      .update(teamsTable)
      .set({ firstSubmittedAt: new Date() })
      .where(eq(teamsTable.id, created.team.id))

    const result = await listTeams(db, creator.id)

    expect(result.teams[0]?.frozen).toBe(true)
  })

  it('blocks joining with already_in_team, ahead of every other reason', async () => {
    await db.insert(eventConfigTable).values({ id: 1, maxTeamSize: 1 })
    const viewer = await insertUser()
    const stranger = await insertUser()
    await createTeam(db, viewer.id, 'Mine')
    const full = await createTeam(db, stranger.id, 'Full')
    if (!full.ok) throw new Error('expected success')

    const result = await listTeams(db, viewer.id)

    const fullTeam = result.teams.find((team) => team.id === full.team.id)
    expect(fullTeam?.joinBlockedReason).toBe('already_in_team')
  })

  it('blocks joining a team with no open slots', async () => {
    await db.insert(eventConfigTable).values({ id: 1, maxTeamSize: 1 })
    const viewer = await insertUser()
    const stranger = await insertUser()
    const created = await createTeam(db, stranger.id, 'Team A')
    if (!created.ok) throw new Error('expected success')

    const result = await listTeams(db, viewer.id)

    expect(result.maxTeamSize).toBe(1)
    expect(result.teams[0]?.slotsAvailable).toBe(0)
    expect(result.teams[0]?.joinBlockedReason).toBe('team_full')
  })

  it('blocks joining another university team when mixing is locked', async () => {
    await db.insert(eventConfigTable).values({ id: 1, mixingLocked: true })
    const viewer = await insertUser('merida')
    const stranger = await insertUser('pucrs')
    const created = await createTeam(db, stranger.id, 'Team A')
    if (!created.ok) throw new Error('expected success')

    const result = await listTeams(db, viewer.id)

    expect(result.mixingLocked).toBe(true)
    expect(result.teams[0]?.joinBlockedReason).toBe('mixed_lock_violation')
  })

  it('leaves joinBlockedReason null on a joinable team', async () => {
    const viewer = await insertUser('merida')
    const stranger = await insertUser('pucrs')
    const created = await createTeam(db, stranger.id, 'Team A')
    if (!created.ok) throw new Error('expected success')

    const result = await listTeams(db, viewer.id)

    expect(result.teams[0]?.joinBlockedReason).toBeNull()
  })

  it('leaves a memberless team joinable when mixing is locked', async () => {
    await db.insert(eventConfigTable).values({ id: 1, mixingLocked: true })
    const viewer = await insertUser('merida')
    await db.insert(teamsTable).values({ name: 'Orphan' })

    const result = await listTeams(db, viewer.id)

    expect(result.teams[0]?.joinBlockedReason).toBeNull()
  })

  // Achado #38: lowering maxTeamSize after a team already formed (reachable
  // via PATCH /organizer/event-config) left slotsAvailable negative instead
  // of clamped, disagreeing with stats.service.ts's countTeams.
  it('clamps slotsAvailable at zero for a team over the new max size', async () => {
    await db.insert(eventConfigTable).values({ id: 1, maxTeamSize: 3 })
    const creator = await insertUser()
    const joiner = await insertUser()
    const created = await createTeam(db, creator.id, 'Team A')
    if (!created.ok) throw new Error('expected success')
    await joinTeam(db, joiner.id, created.team.id)
    await updateEventConfig(db, { maxTeamSize: 1 })

    const result = await listTeams(db, creator.id)

    expect(result.teams[0]?.slotsAvailable).toBe(0)
  })
})

describe('listOrganizerTeams', () => {
  it("exposes every member's userId, email, university and role regardless of viewer", async () => {
    await db.insert(eventConfigTable).values({ id: 1, maxTeamSize: 3 })
    const creator = await insertUser('pucrs')
    const joiner = await insertUser('merida')
    const created = await createTeam(db, creator.id, 'Team A')
    if (!created.ok) throw new Error('expected success')
    await joinTeam(db, joiner.id, created.team.id)

    const result = await listOrganizerTeams(db)

    expect(result).toEqual({
      maxTeamSize: 3,
      teams: [
        {
          id: created.team.id,
          name: 'Team A',
          frozen: false,
          slotsAvailable: 1,
          members: expect.arrayContaining([
            {
              userId: creator.id,
              email: creator.email,
              name: creator.name,
              university: 'pucrs',
              role: 'participant',
            },
            {
              userId: joiner.id,
              email: joiner.email,
              name: joiner.name,
              university: 'merida',
              role: 'participant',
            },
          ]),
        },
      ],
    })
  })

  it('carries a null name for a member that predates the column (#122)', async () => {
    const legacy = await insertUser('pucrs', null)
    const created = await createTeam(db, legacy.id, 'Team A')
    if (!created.ok) throw new Error('expected success')

    const result = await listOrganizerTeams(db)

    expect(result.teams[0]?.members).toEqual([
      {
        userId: legacy.id,
        email: legacy.email,
        name: null,
        university: 'pucrs',
        role: 'participant',
      },
    ])
  })

  it('still lists a team with zero members with an empty members array', async () => {
    await db.insert(teamsTable).values({ name: 'Orphan' })

    const result = await listOrganizerTeams(db)

    expect(result.teams).toEqual([
      expect.objectContaining({ name: 'Orphan', members: [], slotsAvailable: 3 }),
    ])
  })

  it('excludes a removed team', async () => {
    const creator = await insertUser()
    const created = await createTeam(db, creator.id, 'Team A')
    if (!created.ok) throw new Error('expected success')

    await removeTeam(db, created.team.id)
    const result = await listOrganizerTeams(db)

    expect(result.teams).toEqual([])
  })

  it('marks a team that has already submitted as frozen', async () => {
    const creator = await insertUser()
    const created = await createTeam(db, creator.id, 'Team A')
    if (!created.ok) throw new Error('expected success')
    await db
      .update(teamsTable)
      .set({ firstSubmittedAt: new Date() })
      .where(eq(teamsTable.id, created.team.id))

    const result = await listOrganizerTeams(db)

    expect(result.teams[0]?.frozen).toBe(true)
  })

  // Achado #38 — see the same test in the listTeams describe block above.
  it('clamps slotsAvailable at zero for a team over the new max size', async () => {
    await db.insert(eventConfigTable).values({ id: 1, maxTeamSize: 3 })
    const creator = await insertUser()
    const joiner = await insertUser()
    const created = await createTeam(db, creator.id, 'Team A')
    if (!created.ok) throw new Error('expected success')
    await joinTeam(db, joiner.id, created.team.id)
    await updateEventConfig(db, { maxTeamSize: 1 })

    const result = await listOrganizerTeams(db)

    expect(result.teams[0]?.slotsAvailable).toBe(0)
  })
})
