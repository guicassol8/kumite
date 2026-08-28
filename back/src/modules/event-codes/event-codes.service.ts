import { eq } from 'drizzle-orm'

import type { Db } from '../../db/client'
import { eventCodesTable } from '../../db/schema'

import type { EventCode } from './event-codes.schema'

// Exact match, case-sensitive, no normalization. Whether the code is active
// is the caller's job — this returns inactive rows too.
export async function findEventCode(db: Db, code: string): Promise<EventCode | null> {
  const [eventCode] = await db.select().from(eventCodesTable).where(eq(eventCodesTable.code, code))
  return eventCode ?? null
}
