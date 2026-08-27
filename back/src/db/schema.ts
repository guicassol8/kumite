import { sql } from 'drizzle-orm'
import { boolean, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

export const roleEnum = pgEnum('role', ['participant', 'organizer'])
export const universityEnum = pgEnum('university', ['pucrs', 'merida'])

export const usersTable = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: roleEnum('role').notNull(),
    university: universityEnum('university').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('users_lower_email_idx').on(sql`lower(${table.email})`)],
)

export const eventCodesTable = pgTable('event_codes', {
  code: text('code').primaryKey(),
  university: universityEnum('university').notNull(),
  allowedEmailSuffixes: text('allowed_email_suffixes').array().notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
