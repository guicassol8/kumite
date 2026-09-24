import { signJwt } from '@katajs-framework/core/jwt'
import { sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { app } from '../../app'
import { JWT_SECRET, TOKEN_TTL_SECONDS } from '../../config'
import { k } from '../../context'
import { createDb } from '../../db/client'
import { eventConfigTable, usersTable } from '../../db/schema'
import { createUser } from '../users/users.service'

import { getEventConfig, getOrCreateEventConfig, updateEventConfig } from './event-config.service'

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
    expect(config.submissionsPaused).toBe(false)
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

describe('event-config submissionsPaused (#285)', () => {
  it('getEventConfig defaults to not paused when no row exists yet', async () => {
    const config = await getEventConfig(db)
    expect(config.submissionsPaused).toBe(false)
  })

  it('getEventConfig reflects the stored flag', async () => {
    await db.insert(eventConfigTable).values({ id: 1, submissionsPaused: true })
    expect((await getEventConfig(db)).submissionsPaused).toBe(true)
  })

  it('updateEventConfig toggles submissionsPaused alone, leaving the team rules as they were', async () => {
    await updateEventConfig(db, { mixingLocked: true, maxTeamSize: 4 })

    const paused = await updateEventConfig(db, { submissionsPaused: true })
    expect(paused).toMatchObject({ submissionsPaused: true, mixingLocked: true, maxTeamSize: 4 })

    const resumed = await updateEventConfig(db, { submissionsPaused: false })
    expect(resumed).toMatchObject({ submissionsPaused: false, mixingLocked: true, maxTeamSize: 4 })
  })

  it('a team-rules PATCH does not touch the pause flag', async () => {
    await updateEventConfig(db, { submissionsPaused: true })
    const updated = await updateEventConfig(db, { maxTeamSize: 5 })
    expect(updated.submissionsPaused).toBe(true)
  })
})

// #285: the route, not the service, announces the toggle — same shape as
// users.route.ts publishing user.deactivated. The publish is synchronous with
// the PATCH, so connected clients hear about it well inside one heartbeat.
describe('PATCH /organizer/event-config — sse side effect (#285)', () => {
  async function organizerToken() {
    const organizer = await createUser(db, {
      email: `organizer-${crypto.randomUUID()}@example.com`,
      name: 'Org',
      passwordHash: 'hash',
      role: 'organizer',
      university: 'pucrs',
    })
    if (!organizer) throw new Error('expected fixture')
    return signJwt(
      { role: organizer.role, university: organizer.university },
      { secret: JWT_SECRET, subject: organizer.id, expiresInSeconds: TOKEN_TTL_SECONDS },
    )
  }

  async function patch(body: unknown) {
    const token = await organizerToken()
    return app.request('/organizer/event-config', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  beforeEach(async () => {
    await db.execute(sql`truncate table ${usersTable} restart identity cascade`)
  })

  it('pausing answers 200 with the flag on and publishes submissions.paused', async () => {
    const fn = vi.fn()
    const unsubscribe = k.resolve('sseBus').subscribe(fn)

    const res = await patch({ submissionsPaused: true })

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ submissionsPaused: true })
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith({ type: 'submissions.paused', serverTime: expect.any(Date) })
    unsubscribe()
  })

  it('resuming publishes submissions.resumed', async () => {
    await updateEventConfig(db, { submissionsPaused: true })
    const fn = vi.fn()
    const unsubscribe = k.resolve('sseBus').subscribe(fn)

    const res = await patch({ submissionsPaused: false })

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ submissionsPaused: false })
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith({ type: 'submissions.resumed', serverTime: expect.any(Date) })
    unsubscribe()
  })

  it('a PATCH without submissionsPaused publishes nothing', async () => {
    const fn = vi.fn()
    const unsubscribe = k.resolve('sseBus').subscribe(fn)

    const res = await patch({ maxTeamSize: 4 })

    expect(res.status).toBe(200)
    expect(fn).not.toHaveBeenCalled()
    unsubscribe()
  })
})
