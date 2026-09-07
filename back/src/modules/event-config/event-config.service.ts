import { eq } from 'drizzle-orm'

import type { Db } from '../../db/client'
import { eventConfigTable } from '../../db/schema'

import type { EventConfig, UpdateEventConfigBody } from './event-config.schema'

// Table defaults (mixingLocked: false, maxTeamSize: 3) apply even before
// db:seed has inserted the singleton event_config row.
export async function getEventConfig(
  db: Db,
): Promise<{ mixingLocked: boolean; maxTeamSize: number }> {
  const [config] = await db.select().from(eventConfigTable).where(eq(eventConfigTable.id, 1))
  return config
    ? { mixingLocked: config.mixingLocked, maxTeamSize: config.maxTeamSize }
    : { mixingLocked: false, maxTeamSize: 3 }
}

// Same upsert-then-select shape as createTeam's onConflictDoNothing: the
// organizer GET/PATCH routes always operate on a real row, never a synthetic
// default, so a subsequent PATCH has a row to update.
export async function getOrCreateEventConfig(db: Db): Promise<EventConfig> {
  await db.insert(eventConfigTable).values({ id: 1 }).onConflictDoNothing()
  const [config] = await db.select().from(eventConfigTable).where(eq(eventConfigTable.id, 1))
  if (!config) throw new Error('expected event_config row to exist after upsert')
  return config
}

export async function updateEventConfig(
  db: Db,
  patch: UpdateEventConfigBody,
): Promise<EventConfig> {
  await db.insert(eventConfigTable).values({ id: 1 }).onConflictDoNothing()
  const [config] = await db
    .update(eventConfigTable)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(eventConfigTable.id, 1))
    .returning()
  if (!config) throw new Error('expected event_config row to exist after upsert')
  return config
}
