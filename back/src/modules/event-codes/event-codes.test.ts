import { sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { createDb } from '../../db/client'
import { eventCodesTable } from '../../db/schema'

import { findEventCode } from './event-codes.service'

// Runs against the real dockerized Postgres (docker compose up -d) — the
// #24 migration must already be applied.
const db = createDb()

beforeEach(async () => {
  await db.execute(sql`truncate table ${eventCodesTable} restart identity cascade`)
  await db.insert(eventCodesTable).values([
    { code: 'PUCRS2026', university: 'pucrs', allowedEmailSuffixes: ['edu.pucrs.br', 'pucrs.br'] },
    {
      code: 'INACTIVE2026',
      university: 'pucrs',
      allowedEmailSuffixes: ['pucrs.br'],
      active: false,
    },
  ])
})

afterAll(async () => {
  await db.$client.end()
})

describe('event-codes.service findEventCode', () => {
  it('returns the row for a known active code', async () => {
    const eventCode = await findEventCode(db, 'PUCRS2026')
    expect(eventCode?.university).toBe('pucrs')
    expect(eventCode?.active).toBe(true)
  })

  it("returns the row for a known inactive code — the active check is the caller's job", async () => {
    const eventCode = await findEventCode(db, 'INACTIVE2026')
    expect(eventCode?.active).toBe(false)
  })

  it('returns null for an unknown code', async () => {
    expect(await findEventCode(db, 'DOES-NOT-EXIST')).toBeNull()
  })
})
