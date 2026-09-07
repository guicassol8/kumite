import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { createDb } from '../../db/client'
import { eventCodesTable } from '../../db/schema'

import { findEventCode, listEventCodes, updateEventCode } from './event-codes.service'

// Runs against the real dockerized Postgres (docker compose up -d) — the
// #24 migration must already be applied. One row per university, mirroring
// the real seed (db/seed.ts) — updateEventCode's single-row-per-university
// assumption relies on this convention (no DB-level unique constraint on
// `university` yet — see #48's "Discovered from #48" follow-up).
const db = createDb()

beforeEach(async () => {
  await db.execute(sql`truncate table ${eventCodesTable} restart identity cascade`)
  await db.insert(eventCodesTable).values([
    { code: 'PUCRS2026', university: 'pucrs', allowedEmailSuffixes: ['edu.pucrs.br', 'pucrs.br'] },
    { code: 'MERIDA2026', university: 'merida', allowedEmailSuffixes: ['merida.edu.mx'] },
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
    await db
      .update(eventCodesTable)
      .set({ active: false })
      .where(eq(eventCodesTable.code, 'PUCRS2026'))

    const eventCode = await findEventCode(db, 'PUCRS2026')
    expect(eventCode?.active).toBe(false)
  })

  it('returns null for an unknown code', async () => {
    expect(await findEventCode(db, 'DOES-NOT-EXIST')).toBeNull()
  })
})

describe('event-codes.service listEventCodes', () => {
  it('returns both seeded rows, ordered by university', async () => {
    const eventCodes = await listEventCodes(db)
    // `university` is a pg enum: ORDER BY sorts by declaration order
    // (pucrs, merida — users.schema.ts's UniversitySchema), not alphabetically.
    expect(eventCodes.map((eventCode) => eventCode.university)).toEqual(['pucrs', 'merida'])
  })
})

describe('event-codes.service updateEventCode', () => {
  it('updates the code only', async () => {
    const result = await updateEventCode(db, 'pucrs', { code: 'PUCRS2027' })
    expect(result).toEqual({ ok: true, eventCode: expect.objectContaining({ code: 'PUCRS2027' }) })
  })

  it('updates allowedEmailSuffixes only', async () => {
    const result = await updateEventCode(db, 'merida', {
      allowedEmailSuffixes: ['merida.edu.mx', 'alumnos.merida.edu.mx'],
    })
    expect(result).toEqual({
      ok: true,
      eventCode: expect.objectContaining({
        allowedEmailSuffixes: ['merida.edu.mx', 'alumnos.merida.edu.mx'],
      }),
    })
  })

  it('updates active only', async () => {
    const result = await updateEventCode(db, 'pucrs', { active: false })
    expect(result).toEqual({ ok: true, eventCode: expect.objectContaining({ active: false }) })
  })

  it('updates code, suffixes and active together', async () => {
    const result = await updateEventCode(db, 'pucrs', {
      code: 'PUCRS2027',
      allowedEmailSuffixes: ['pucrs.br'],
      active: false,
    })
    expect(result).toEqual({
      ok: true,
      eventCode: expect.objectContaining({
        code: 'PUCRS2027',
        allowedEmailSuffixes: ['pucrs.br'],
        active: false,
      }),
    })
  })

  it('returns not_found for a university with no row', async () => {
    await db.delete(eventCodesTable).where(eq(eventCodesTable.university, 'merida'))

    expect(await updateEventCode(db, 'merida', { active: false })).toEqual({
      ok: false,
      error: 'not_found',
    })
  })

  it("returns code_taken when the new code collides with the other university's code", async () => {
    expect(await updateEventCode(db, 'merida', { code: 'PUCRS2026' })).toEqual({
      ok: false,
      error: 'code_taken',
    })
  })
})
