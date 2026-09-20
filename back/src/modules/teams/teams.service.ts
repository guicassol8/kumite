import { and, eq, isNull, sql } from 'drizzle-orm'
import postgres from 'postgres'

import type { Db } from '../../db/client'
import { teamMembersTable, teamsTable, usersTable } from '../../db/schema'

import { getEventConfig } from '../event-config/event-config.service'
import type { University } from '../users/users.schema'

import type {
  JoinBlockedReason,
  OrganizerTeam,
  OrganizerTeamsList,
  Team,
  TeamSummary,
  TeamsList,
} from './teams.schema'

// Achados #10 and #11: the name used to reach both the length check and the
// insert exactly as typed, so "   " was a valid 3-character name and
// "Os Dragoes " sailed past teams_lower_name_idx, which folds case but not
// whitespace — leaving two teams nobody can tell apart on the leaderboard.
//
// It lives here rather than in a `z.transform()` inside teams.schema.ts on
// purpose: the persistence boundary is what must be normalized, so anything
// calling the service directly (tests, seeds) gets the same rule. The schema
// still carries a `.trim()`, which is what buys the 422 for a blank name.
//
// `\s` covers tabs, newlines and NBSP (U+00A0). Zero-width characters are
// deliberately out of scope: they are not the reported defect and sanitizing
// them is a much wider rule.
export function normalizeTeamName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
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
      // `userName`, not `name`: `teamName` above is the team's.
      userName: usersTable.name,
    })
    .from(teamsTable)
    .leftJoin(teamMembersTable, eq(teamMembersTable.teamId, teamsTable.id))
    .leftJoin(usersTable, eq(usersTable.id, teamMembersTable.userId))
    .where(isNull(teamsTable.removedAt))
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
        name: row.teamId === myTeamId ? row.userName : null,
      })
    }
  }

  for (const team of teams.values()) {
    // Clamped (achado #38): a team can end up over `maxTeamSize` after the
    // organizer lowers it post-formation, and stats.service.ts's countTeams
    // already floors the same subtraction at 0 — this keeps both endpoints
    // agreeing instead of one going negative.
    team.slotsAvailable = Math.max(0, config.maxTeamSize - team.members.length)
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

// Organizer-scoped listing (#51): same join shape as listTeams, but
// unanonymized (real userId/email/role) and not viewer-scoped.
export async function listOrganizerTeams(db: Db): Promise<OrganizerTeamsList> {
  const config = await getEventConfig(db)

  const rows = await db
    .select({
      teamId: teamsTable.id,
      teamName: teamsTable.name,
      teamFirstSubmittedAt: teamsTable.firstSubmittedAt,
      userId: usersTable.id,
      email: usersTable.email,
      userName: usersTable.name,
      university: usersTable.university,
      role: usersTable.role,
    })
    .from(teamsTable)
    .leftJoin(teamMembersTable, eq(teamMembersTable.teamId, teamsTable.id))
    .leftJoin(usersTable, eq(usersTable.id, teamMembersTable.userId))
    .where(isNull(teamsTable.removedAt))
    .orderBy(teamsTable.createdAt)

  const teams = new Map<string, OrganizerTeam>()
  for (const row of rows) {
    let team = teams.get(row.teamId)
    if (!team) {
      team = {
        id: row.teamId,
        name: row.teamName,
        frozen: row.teamFirstSubmittedAt !== null,
        slotsAvailable: config.maxTeamSize,
        members: [],
      }
      teams.set(row.teamId, team)
    }
    if (row.userId && row.email && row.university && row.role) {
      team.members.push({
        userId: row.userId,
        email: row.email,
        // Outside the guard above on purpose: a null name is a legacy account,
        // not a missing join row.
        name: row.userName,
        university: row.university,
        role: row.role,
      })
    }
  }

  for (const team of teams.values()) {
    // Clamped (achado #38) — see the same comment in listTeams above.
    team.slotsAvailable = Math.max(0, config.maxTeamSize - team.members.length)
  }

  return { maxTeamSize: config.maxTeamSize, teams: [...teams.values()] }
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
  // Transactional (achado #31): a failed member insert used to leave a
  // memberless team row committed, permanently hoarding its name under
  // teams_lower_name_idx. Wrapping both inserts rolls the team back too.
  const normalized = normalizeTeamName(name)

  return db.transaction(async (tx) => {
    const [team] = await tx
      .insert(teamsTable)
      .values({ name: normalized })
      .onConflictDoNothing()
      .returning()
    if (!team) return { ok: false, error: 'name_taken' }

    await tx.insert(teamMembersTable).values({ userId, teamId: team.id })

    return { ok: true, team }
  })
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

  const [{ mixingLocked, maxTeamSize }, [joiningUser]] = await Promise.all([
    getEventConfig(db),
    db.select().from(usersTable).where(eq(usersTable.id, userId)),
  ])
  if (!joiningUser) throw new Error('expected joining user to exist')

  // Transactional + advisory-locked (achado #22): the capacity check and the
  // insert used to run as separate read-then-write statements, so two joiners
  // could both pass the check before either had inserted. The lock is scoped
  // to this team's id, so it only ever serializes joiners racing each other,
  // never unrelated teams — same idiom as password-reset.service.ts.
  return db.transaction(async (tx) => {
    const lockKey = `team-join:${teamId}`
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lockKey}::text))`)

    const members = await tx
      .select({ university: usersTable.university })
      .from(teamMembersTable)
      .innerJoin(usersTable, eq(usersTable.id, teamMembersTable.userId))
      .where(eq(teamMembersTable.teamId, teamId))

    if (members.length >= maxTeamSize) return { ok: false, error: 'team_full' }
    if (mixingLocked && members.some((member) => member.university !== joiningUser.university)) {
      return { ok: false, error: 'mixed_lock_violation' }
    }

    await tx.insert(teamMembersTable).values({ userId, teamId })

    return { ok: true, team }
  })
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
      .set({ name: normalizeTeamName(name), updatedAt: new Date() })
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

  const { maxTeamSize } = await getEventConfig(db)

  // Achado M1 (#276): the capacity check and the update ran as two unlocked
  // statements, so two organizers moving different members into the same team
  // both read a free slot before either had written — the very TOCTOU joinTeam
  // fixed in #22. The lock key is deliberately the one joinTeam uses, so a
  // join and a move racing for the same slot serialize against each other too.
  return db.transaction(async (tx) => {
    const lockKey = `team-join:${destinationTeamId}`
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lockKey}::text))`)

    // Read under the lock, not before it: validated outside the transaction,
    // the destination could be removed while this move waited its turn, and
    // the member would land on a team nobody can see. `member_not_found` still
    // wins over `team_not_found` — the membership check above comes first.
    const [destination] = await tx
      .select()
      .from(teamsTable)
      .where(and(eq(teamsTable.id, destinationTeamId), isNull(teamsTable.removedAt)))
    if (!destination) return { ok: false, error: 'team_not_found' }

    const members = await tx
      .select()
      .from(teamMembersTable)
      .where(eq(teamMembersTable.teamId, destinationTeamId))
    if (members.length >= maxTeamSize) return { ok: false, error: 'team_full' }

    await tx
      .update(teamMembersTable)
      .set({ teamId: destinationTeamId })
      .where(eq(teamMembersTable.userId, userId))

    return { ok: true }
  })
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

export type RemoveTeamResult = { ok: true } | { ok: false; error: 'not_found' }

export async function removeTeam(db: Db, teamId: string): Promise<RemoveTeamResult> {
  // Achado M1 (#276): marking the team removed and unlinking its members were
  // two loose statements. A failure between them committed the first half —
  // the team vanished from every listing while its members stayed pinned to
  // it, in no visible team and unable to join another. Both halves now live in
  // one transaction, so the team is removed with its members or not at all.
  //
  // Same key as joinTeam/moveMember: without it this delete of the team's
  // memberships can slip between a move's capacity check and its write, and
  // the moved member is left pinned to a team that no longer exists.
  return db.transaction(async (tx) => {
    const lockKey = `team-join:${teamId}`
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lockKey}::text))`)

    const [team] = await tx
      .update(teamsTable)
      .set({ removedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(teamsTable.id, teamId), isNull(teamsTable.removedAt)))
      .returning()
    if (!team) return { ok: false, error: 'not_found' }

    // Submissions stay untouched (ON DELETE RESTRICT + the audit requirement):
    // only membership is deleted, leaving members teamless.
    await tx.delete(teamMembersTable).where(eq(teamMembersTable.teamId, teamId))

    return { ok: true }
  })
}
