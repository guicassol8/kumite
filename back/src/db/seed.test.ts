import { sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { createDb } from './client'
import { eventCodesTable, usersTable } from './schema'
import { seed } from './seed'

// Runs against the real dockerized Postgres (docker compose up -d) — the
// migrations from #24's T3 must already be applied.
const db = createDb()

const ORGANIZER_EMAIL = 'organizer@example.com'
const ORGANIZER_PASSWORD = 'supersecret'

beforeEach(async () => {
  process.env['ORGANIZER_EMAIL'] = ORGANIZER_EMAIL
  process.env['ORGANIZER_PASSWORD'] = ORGANIZER_PASSWORD
  await db.execute(sql`truncate table ${usersTable}, ${eventCodesTable} restart identity cascade`)
})

afterAll(async () => {
  await db.$client.end()
})

describe('seed', () => {
  it('creates the initial organizer and the PUCRS/Mérida event codes', async () => {
    await seed(db)

    const users = await db.select().from(usersTable)
    expect(users).toHaveLength(1)
    expect(users[0]?.email).toBe(ORGANIZER_EMAIL)
    expect(users[0]?.role).toBe('organizer')

    const eventCodes = await db.select().from(eventCodesTable)
    const pucrs = eventCodes.find((row) => row.code === 'PUCRS2026')
    const merida = eventCodes.find((row) => row.code === 'MERIDA2026')
    expect(eventCodes).toHaveLength(2)
    expect(pucrs?.allowedEmailSuffixes).toEqual(['edu.pucrs.br', 'pucrs.br'])
    expect(merida?.allowedEmailSuffixes).toEqual(['merida.edu.mx'])
  })

  it('rejects a second user whose email differs only by case', async () => {
    await db.insert(usersTable).values({
      email: 'ada@example.com',
      passwordHash: 'hash',
      role: 'participant',
      university: 'pucrs',
    })

    await expect(
      db.insert(usersTable).values({
        email: 'Ada@Example.com',
        passwordHash: 'hash',
        role: 'participant',
        university: 'pucrs',
      }),
    ).rejects.toThrow()
  })

  it('stays idempotent when run twice', async () => {
    await seed(db)
    await seed(db)

    expect(await db.select().from(usersTable)).toHaveLength(1)
    expect(await db.select().from(eventCodesTable)).toHaveLength(2)
  })
})
