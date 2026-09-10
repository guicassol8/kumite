import { asc, eq } from 'drizzle-orm'
import postgres from 'postgres'

import type { Db } from '../../db/client'
import { eventCodesTable } from '../../db/schema'

import type { University } from '../users/users.schema'

import type { EventCode, UpdateEventCodeBody } from './event-codes.schema'

// One row per university is a DB invariant since #125
// (`event_codes_university_idx`), not just a seed convention — both this
// lookup and updateEventCode below read/write "the" row of a university.

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
    // Only event_codes_pkey is handled: no patch writes `university`, so this
    // update cannot violate event_codes_university_idx (#125) — hence no new
    // error in UpdateEventCodeResult and no change to the typed API surface.
    const cause = error instanceof Error ? error.cause : undefined
    if (cause instanceof postgres.PostgresError && cause.constraint_name === 'event_codes_pkey') {
      return { ok: false, error: 'code_taken' }
    }
    throw error
  }
}
