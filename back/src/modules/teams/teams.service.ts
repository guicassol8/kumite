import { and, eq, isNull } from 'drizzle-orm'
import postgres from 'postgres'

import type { Db } from '../../db/client'
import { eventConfigTable, teamMembersTable, teamsTable, usersTable } from '../../db/schema'

import type { University } from '../users/users.schema'

import type { JoinBlockedReason, Team, TeamSummary, TeamsList } from './teams.schema'

// Table defaults (mixingLocked: false, maxTeamSize: 3) apply even before
// db:seed has inserted the singleton event_config row.
async function getEventConfig(db: Db): Promise<{ mixingLocked: boolean; maxTeamSize: number }> {
  const [config] = await db.select().from(eventConfigTable).where(eq(eventConfigTable.id, 1))
  return config
    ? { mixingLocked: config.mixingLocked, maxTeamSize: config.maxTeamSize }
    : { mixingLocked: false, maxTeamSize: 3 }
}

// Mirrors joinTeam's guards, in the same order, so a disabled button in the
// UI and a 409 from the API always agree on the reason.
function resolveJoinBlockedReason(
  members: { university: University }[],
  viewer: { university: University; hasTeam: boolean },
  config: { mixingLocked: boolean; maxTeamSize: number },
): JoinBlockedReason | null {
  if (viewer.hasTeam) return 'already_in_team'
  if (members.length >= config.maxTeamSize) return 'team_full'
  if (config.mixingLocked && members.some((member) => member.university !== viewer.university)) {
    return 'mixed_lock_violation'
  }
  return null
}

export async function listTeams(db: Db, viewerId: string): Promise<TeamsList> {
  const [config, [viewer], [viewerMembership]] = await Promise.all([
    getEventConfig(db),
    db.select().from(usersTable).where(eq(usersTable.id, viewerId)),
    db.select().from(teamMembersTable).where(eq(teamMembersTable.userId, viewerId)),
  ])
  if (!viewer) throw new Error('expected viewer to exist')
  const myTeamId = viewerMembership?.teamId ?? null

  const rows = await db
    .select({
      teamId: teamsTable.id,
      teamName: teamsTable.name,
      teamFirstSubmittedAt: teamsTable.firstSubmittedAt,
      university: usersTable.university,
      email: usersTable.email,
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
        slotsAvailable: config.maxTeamSize,
        frozen: row.teamFirstSubmittedAt !== null,
        joinBlockedReason: null,
      }
      teams.set(row.teamId, team)
    }
    if (row.university) {
      team.members.push({
        university: row.university,
        email: row.teamId === myTeamId ? row.email : null,
      })
    }
  }

  for (const team of teams.values()) {
    team.slotsAvailable = config.maxTeamSize - team.members.length
    team.joinBlockedReason = resolveJoinBlockedReason(
      team.members,
      { university: viewer.university, hasTeam: myTeamId !== null },
      config,
    )
  }

  return {
    maxTeamSize: config.maxTeamSize,
    mixingLocked: config.mixingLocked,
    myTeamId,
    teams: [...teams.values()],
  }
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

// --- Organizer moderation (#50) ---
//
// All three actions below intentionally skip the joinTeam/leaveTeam guards
// (frozen check, mixing lock): the organizer is the one sanctioned way to
// move team membership after the 1st submission, per #50's spec.

export type RenameTeamResult =
  | { ok: true; team: Team }
  | { ok: false; error: 'not_found' }
  | { ok: false; error: 'name_taken' }

export async function renameTeam(db: Db, teamId: string, name: string): Promise<RenameTeamResult> {
  try {
    const [team] = await db
      .update(teamsTable)
      .set({ name, updatedAt: new Date() })
      .where(and(eq(teamsTable.id, teamId), isNull(teamsTable.removedAt)))
      .returning()
    if (!team) return { ok: false, error: 'not_found' }

    return { ok: true, team }
  } catch (error) {
    // Same pattern as openRound (rounds.service.ts): the unique index is the
    // real source of truth for name collisions, caught here rather than
    // pre-checked to avoid a race between the check and the update.
    const cause = error instanceof Error ? error.cause : undefined
    if (
      cause instanceof postgres.PostgresError &&
      cause.constraint_name === 'teams_lower_name_idx'
    ) {
      return { ok: false, error: 'name_taken' }
    }
    throw error
  }
}

export type MoveMemberResult =
  | { ok: true }
  | { ok: false; error: 'member_not_found' }
  | { ok: false; error: 'team_not_found' }
  | { ok: false; error: 'team_full' }

export async function moveMember(
  db: Db,
  userId: string,
  destinationTeamId: string,
): Promise<MoveMemberResult> {
  const [membership] = await db
    .select()
    .from(teamMembersTable)
    .where(eq(teamMembersTable.userId, userId))
  if (!membership) return { ok: false, error: 'member_not_found' }

  const [destination] = await db
    .select()
    .from(teamsTable)
    .where(and(eq(teamsTable.id, destinationTeamId), isNull(teamsTable.removedAt)))
  if (!destination) return { ok: false, error: 'team_not_found' }

  const [members, { maxTeamSize }] = await Promise.all([
    db.select().from(teamMembersTable).where(eq(teamMembersTable.teamId, destinationTeamId)),
    getEventConfig(db),
  ])
  if (members.length >= maxTeamSize) return { ok: false, error: 'team_full' }

  await db
    .update(teamMembersTable)
    .set({ teamId: destinationTeamId })
    .where(eq(teamMembersTable.userId, userId))

  return { ok: true }
}

export type RemoveMemberResult = { ok: true } | { ok: false; error: 'not_found' }

export async function removeMember(db: Db, userId: string): Promise<RemoveMemberResult> {
  const [membership] = await db
    .select()
    .from(teamMembersTable)
    .where(eq(teamMembersTable.userId, userId))
  if (!membership) return { ok: false, error: 'not_found' }

  // Unlike leaveTeam, no team_frozen guard: this route is the sanctioned way
  // to remove a member from a frozen team.
  await db.delete(teamMembersTable).where(eq(teamMembersTable.userId, userId))

  return { ok: true }
}
