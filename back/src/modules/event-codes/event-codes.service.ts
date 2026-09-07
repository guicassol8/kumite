import { asc, eq } from 'drizzle-orm'
import postgres from 'postgres'

import type { Db } from '../../db/client'
import { eventCodesTable } from '../../db/schema'

import type { University } from '../users/users.schema'

import type { EventCode, UpdateEventCodeBody } from './event-codes.schema'

// Exact match, case-sensitive, no normalization. Whether the code is active
// is the caller's job — this returns inactive rows too.
export async function findEventCode(db: Db, code: string): Promise<EventCode | null> {
  const [eventCode] = await db.select().from(eventCodesTable).where(eq(eventCodesTable.code, code))
  return eventCode ?? null
}

export async function listEventCodes(db: Db): Promise<EventCode[]> {
  return db.select().from(eventCodesTable).orderBy(asc(eventCodesTable.university))
}

export type UpdateEventCodeResult =
  | { ok: true; eventCode: EventCode }
  | { ok: false; error: 'not_found' }
  | { ok: false; error: 'code_taken' }

export async function updateEventCode(
  db: Db,
  university: University,
  patch: UpdateEventCodeBody,
): Promise<UpdateEventCodeResult> {
  try {
    const [eventCode] = await db
      .update(eventCodesTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(eventCodesTable.university, university))
      .returning()
    if (!eventCode) return { ok: false, error: 'not_found' }

    return { ok: true, eventCode }
  } catch (error) {
    // Same pattern as renameTeam (teams.service.ts): the PK is the real
    // source of truth for code collisions, caught here rather than
    // pre-checked to avoid a race between the check and the update.
    const cause = error instanceof Error ? error.cause : undefined
    if (cause instanceof postgres.PostgresError && cause.constraint_name === 'event_codes_pkey') {
      return { ok: false, error: 'code_taken' }
    }
    throw error
  }
}
