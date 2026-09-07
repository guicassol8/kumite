import { sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { createDb } from '../../db/client'
import { eventConfigTable } from '../../db/schema'

import { getOrCreateEventConfig, updateEventConfig } from './event-config.service'

// Runs against the real dockerized Postgres (docker compose up -d).
const db = createDb()

beforeEach(async () => {
  await db.execute(sql`truncate table ${eventConfigTable} restart identity cascade`)
})

afterAll(async () => {
  await db.$client.end()
})

describe('event-config.service getOrCreateEventConfig', () => {
  it('creates the singleton row with table defaults when none exists', async () => {
    const config = await getOrCreateEventConfig(db)
    expect(config.mixingLocked).toBe(false)
    expect(config.maxTeamSize).toBe(3)
  })

  it('returns the existing row without changing it', async () => {
    await db.insert(eventConfigTable).values({ id: 1, mixingLocked: true, maxTeamSize: 5 })

    const config = await getOrCreateEventConfig(db)
    expect(config.mixingLocked).toBe(true)
    expect(config.maxTeamSize).toBe(5)
  })
})

describe('event-config.service updateEventConfig', () => {
  it('updates mixingLocked only, bumping updatedAt', async () => {
    const before = await getOrCreateEventConfig(db)

    const updated = await updateEventConfig(db, { mixingLocked: true })
    expect(updated.mixingLocked).toBe(true)
    expect(updated.maxTeamSize).toBe(3)
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(before.updatedAt.getTime())
  })

  it('updates maxTeamSize only', async () => {
    const updated = await updateEventConfig(db, { maxTeamSize: 5 })
    expect(updated.maxTeamSize).toBe(5)
    expect(updated.mixingLocked).toBe(false)
  })

  it('updates both fields together', async () => {
    const updated = await updateEventConfig(db, { mixingLocked: true, maxTeamSize: 4 })
    expect(updated.mixingLocked).toBe(true)
    expect(updated.maxTeamSize).toBe(4)
  })

  it('creates the row first when none exists yet', async () => {
    const updated = await updateEventConfig(db, { maxTeamSize: 6 })
    expect(updated.maxTeamSize).toBe(6)
    expect(updated.mixingLocked).toBe(false)
  })
})
