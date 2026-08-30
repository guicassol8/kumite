import { eq } from 'drizzle-orm'

import type { Db } from '../../db/client'
import { eventConfigTable, teamMembersTable, teamsTable, usersTable } from '../../db/schema'

import type { Team, TeamSummary } from './teams.schema'

// Table defaults (mixingLocked: false, maxTeamSize: 3) apply even before
// db:seed has inserted the singleton event_config row.
async function getEventConfig(db: Db): Promise<{ mixingLocked: boolean; maxTeamSize: number }> {
  const [config] = await db.select().from(eventConfigTable).where(eq(eventConfigTable.id, 1))
  return config
    ? { mixingLocked: config.mixingLocked, maxTeamSize: config.maxTeamSize }
    : { mixingLocked: false, maxTeamSize: 3 }
}

export async function listTeams(db: Db): Promise<TeamSummary[]> {
  const { maxTeamSize } = await getEventConfig(db)

  const rows = await db
    .select({
      teamId: teamsTable.id,
      teamName: teamsTable.name,
      teamCreatedAt: teamsTable.createdAt,
      university: usersTable.university,
    })
    .from(teamsTable)
    .leftJoin(teamMembersTable, eq(teamMembersTable.teamId, teamsTable.id))
    .leftJoin(usersTable, eq(usersTable.id, teamMembersTable.userId))
    .orderBy(teamsTable.createdAt)

  const teams = new Map<string, TeamSummary>()
  for (const row of rows) {
    let team = teams.get(row.teamId)
    if (!team) {
      team = {
        id: row.teamId,
        name: row.teamName,
        members: [],
        maxTeamSize,
        slotsAvailable: maxTeamSize,
      }
      teams.set(row.teamId, team)
    }
    if (row.university) team.members.push({ university: row.university })
  }
  for (const team of teams.values()) team.slotsAvailable = maxTeamSize - team.members.length

  return [...teams.values()]
}

export type CreateTeamResult =
  | { ok: true; team: Team }
  | { ok: false; error: 'already_in_team' }
  | { ok: false; error: 'name_taken' }

export async function createTeam(db: Db, userId: string, name: string): Promise<CreateTeamResult> {
  const [existingMembership] = await db
    .select()
    .from(teamMembersTable)
    .where(eq(teamMembersTable.userId, userId))
  if (existingMembership) return { ok: false, error: 'already_in_team' }

  // No target: the only unique constraint on `teams` is the lower(name)
  // index this insert itself would hit — same onConflictDoNothing shape as
  // createUser (users.service.ts).
  const [team] = await db.insert(teamsTable).values({ name }).onConflictDoNothing().returning()
  if (!team) return { ok: false, error: 'name_taken' }

  await db.insert(teamMembersTable).values({ userId, teamId: team.id })

  return { ok: true, team }
}

export type JoinTeamResult =
  | { ok: true; team: Team }
  | { ok: false; error: 'already_in_team' }
  | { ok: false; error: 'not_found' }
  | { ok: false; error: 'team_full' }
  | { ok: false; error: 'mixed_lock_violation' }

export async function joinTeam(db: Db, userId: string, teamId: string): Promise<JoinTeamResult> {
  const [existingMembership] = await db
    .select()
    .from(teamMembersTable)
    .where(eq(teamMembersTable.userId, userId))
  if (existingMembership) return { ok: false, error: 'already_in_team' }

  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId))
  if (!team) return { ok: false, error: 'not_found' }

  const [members, { mixingLocked, maxTeamSize }, [joiningUser]] = await Promise.all([
    db
      .select({ university: usersTable.university })
      .from(teamMembersTable)
      .innerJoin(usersTable, eq(usersTable.id, teamMembersTable.userId))
      .where(eq(teamMembersTable.teamId, teamId)),
    getEventConfig(db),
    db.select().from(usersTable).where(eq(usersTable.id, userId)),
  ])
  if (!joiningUser) throw new Error('expected joining user to exist')

  if (members.length >= maxTeamSize) return { ok: false, error: 'team_full' }
  if (mixingLocked && members.some((member) => member.university !== joiningUser.university)) {
    return { ok: false, error: 'mixed_lock_violation' }
  }

  await db.insert(teamMembersTable).values({ userId, teamId })

  return { ok: true, team }
}

export type LeaveTeamResult =
  | { ok: true }
  | { ok: false; error: 'not_in_team' }
  | { ok: false; error: 'team_frozen' }

export async function leaveTeam(db: Db, userId: string): Promise<LeaveTeamResult> {
  const [membership] = await db
    .select()
    .from(teamMembersTable)
    .where(eq(teamMembersTable.userId, userId))
  if (!membership) return { ok: false, error: 'not_in_team' }

  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, membership.teamId))
  if (team?.firstSubmittedAt) return { ok: false, error: 'team_frozen' }

  await db.delete(teamMembersTable).where(eq(teamMembersTable.userId, userId))

  return { ok: true }
}
