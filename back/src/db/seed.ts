import argon2 from 'argon2'
import { z } from 'zod'

import type { Db } from './client'
import { createDb } from './client'
import { eventCodesTable, usersTable } from './schema'

// Validated only here, not in config.ts's global EnvSchema — `pnpm dev` and
// `pnpm test` don't need an organizer account, only `pnpm db:seed` does.
const SeedEnvSchema = z.object({
  ORGANIZER_EMAIL: z.string().email(),
  ORGANIZER_PASSWORD: z.string().min(8),
})

export async function seed(db: Db): Promise<void> {
  const { ORGANIZER_EMAIL, ORGANIZER_PASSWORD } = SeedEnvSchema.parse(process.env)

  const passwordHash = await argon2.hash(ORGANIZER_PASSWORD)
  // No target: the only unique constraints on `users` are the id PK (a fresh
  // random uuid) and the lower(email) index this seed itself would hit.
  await db
    .insert(usersTable)
    .values({
      email: ORGANIZER_EMAIL.toLowerCase(),
      passwordHash,
      role: 'organizer',
      university: 'pucrs',
    })
    .onConflictDoNothing()

  await db
    .insert(eventCodesTable)
    .values([
      {
        code: 'PUCRS2026',
        university: 'pucrs',
        allowedEmailSuffixes: ['edu.pucrs.br', 'pucrs.br'],
      },
      {
        code: 'MERIDA2026',
        university: 'merida',
        allowedEmailSuffixes: ['merida.edu.mx'],
      },
    ])
    .onConflictDoNothing()
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const db = createDb()
  await seed(db)
  // postgres-js keeps the socket open otherwise, so the CLI script never exits.
  await db.$client.end()
}
