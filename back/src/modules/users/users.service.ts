import { and, eq, sql } from 'drizzle-orm'

import type { Db } from '../../db/client'
import { teamMembersTable, teamsTable, usersTable } from '../../db/schema'

import type { ListUsersQuery, NewUser, User, UserList, UserSummary } from './users.schema'

// null on a duplicate email (case-insensitive, per the `users_lower_email_idx`
// unique index) — same onConflictDoNothing mechanism as db/seed.ts.
export async function createUser(db: Db, input: NewUser): Promise<User | null> {
  const [user] = await db.insert(usersTable).values(input).onConflictDoNothing().returning()
  return user ?? null
}

// Case-insensitive, mirroring the `users_lower_email_idx` unique index.
export async function findUserByEmail(db: Db, email: string): Promise<User | null> {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(sql`lower(${usersTable.email}) = lower(${email})`)
  return user ?? null
}

export async function findUserById(db: Db, id: string): Promise<User | null> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id))
  return user ?? null
}

const userSummaryColumns = {
  id: usersTable.id,
  email: usersTable.email,
  role: usersTable.role,
  university: usersTable.university,
  active: usersTable.active,
  createdAt: usersTable.createdAt,
  updatedAt: usersTable.updatedAt,
  teamId: teamsTable.id,
  teamName: teamsTable.name,
}

type UserSummaryRow = {
  id: string
  email: string
  role: User['role']
  university: User['university']
  active: boolean
  createdAt: Date
  updatedAt: Date
  teamId: string | null
  teamName: string | null
}

function toUserSummary(row: UserSummaryRow): UserSummary {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    university: row.university,
    active: row.active,
    team: row.teamId && row.teamName ? { id: row.teamId, name: row.teamName } : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

async function getUserSummary(db: Db, userId: string): Promise<UserSummary | null> {
  const [row] = await db
    .select(userSummaryColumns)
    .from(usersTable)
    .leftJoin(teamMembersTable, eq(teamMembersTable.userId, usersTable.id))
    .leftJoin(teamsTable, eq(teamsTable.id, teamMembersTable.teamId))
    .where(eq(usersTable.id, userId))
  return row ? toUserSummary(row) : null
}

// Email-fragment search only (see the #52 plan's scope note) — case
// insensitive substring match, plus optional role/university/team filters.
export async function listUsers(db: Db, filters: ListUsersQuery): Promise<UserList> {
  const conditions = []
  if (filters.q) {
    conditions.push(sql`lower(${usersTable.email}) like lower(${`%${filters.q}%`})`)
  }
  if (filters.role) conditions.push(eq(usersTable.role, filters.role))
  if (filters.university) conditions.push(eq(usersTable.university, filters.university))
  if (filters.teamId) conditions.push(eq(teamMembersTable.teamId, filters.teamId))
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const query = db
    .select(userSummaryColumns)
    .from(usersTable)
    .leftJoin(teamMembersTable, eq(teamMembersTable.userId, usersTable.id))
    .leftJoin(teamsTable, eq(teamsTable.id, teamMembersTable.teamId))
    .orderBy(usersTable.createdAt)
    .limit(filters.limit)
    .offset(filters.offset)
  const countQuery = db
    .select({ count: sql<number>`count(*)::int` })
    .from(usersTable)
    .leftJoin(teamMembersTable, eq(teamMembersTable.userId, usersTable.id))

  const [rows, [countRow]] = await Promise.all([
    whereClause ? query.where(whereClause) : query,
    whereClause ? countQuery.where(whereClause) : countQuery,
  ])

  return { items: rows.map(toUserSummary), total: countRow?.count ?? 0 }
}

export type PromoteResult = { ok: true; user: UserSummary } | { ok: false; error: 'not_found' }

export async function promoteUser(db: Db, userId: string): Promise<PromoteResult> {
  const existing = await findUserById(db, userId)
  if (!existing) return { ok: false, error: 'not_found' }

  if (existing.role !== 'organizer') {
    await db
      .update(usersTable)
      .set({ role: 'organizer', updatedAt: new Date() })
      .where(eq(usersTable.id, userId))
  }

  const user = await getUserSummary(db, userId)
  if (!user) throw new Error('expected user to still exist after promote')
  return { ok: true, user }
}

export type DemoteResult =
  | { ok: true; user: UserSummary }
  | { ok: false; error: 'not_found' }
  | { ok: false; error: 'cannot_demote_self' }

export async function demoteUser(
  db: Db,
  actingUserId: string,
  userId: string,
): Promise<DemoteResult> {
  if (actingUserId === userId) return { ok: false, error: 'cannot_demote_self' }

  const existing = await findUserById(db, userId)
  if (!existing) return { ok: false, error: 'not_found' }

  if (existing.role !== 'participant') {
    await db
      .update(usersTable)
      .set({ role: 'participant', updatedAt: new Date() })
      .where(eq(usersTable.id, userId))
  }

  const user = await getUserSummary(db, userId)
  if (!user) throw new Error('expected user to still exist after demote')
  return { ok: true, user }
}

export type DeactivateResult =
  | { ok: true; user: UserSummary }
  | { ok: false; error: 'not_found' }
  | { ok: false; error: 'cannot_deactivate_self' }

export async function deactivateUser(
  db: Db,
  actingUserId: string,
  userId: string,
): Promise<DeactivateResult> {
  if (actingUserId === userId) return { ok: false, error: 'cannot_deactivate_self' }

  const existing = await findUserById(db, userId)
  if (!existing) return { ok: false, error: 'not_found' }

  if (existing.active) {
    await db
      .update(usersTable)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(usersTable.id, userId))
  }

  const user = await getUserSummary(db, userId)
  if (!user) throw new Error('expected user to still exist after deactivate')
  return { ok: true, user }
}

export type ReactivateResult = { ok: true; user: UserSummary } | { ok: false; error: 'not_found' }

export async function reactivateUser(db: Db, userId: string): Promise<ReactivateResult> {
  const existing = await findUserById(db, userId)
  if (!existing) return { ok: false, error: 'not_found' }

  if (!existing.active) {
    await db
      .update(usersTable)
      .set({ active: true, updatedAt: new Date() })
      .where(eq(usersTable.id, userId))
  }

  const user = await getUserSummary(db, userId)
  if (!user) throw new Error('expected user to still exist after reactivate')
  return { ok: true, user }
}
