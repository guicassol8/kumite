import { sql } from 'drizzle-orm'
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

import type { JsonValue } from '../lib/json'

export const roleEnum = pgEnum('role', ['participant', 'organizer'])
export const universityEnum = pgEnum('university', ['pucrs', 'merida'])
export const difficultyEnum = pgEnum('difficulty', ['easy', 'medium', 'hard'])
export const problemStatusEnum = pgEnum('problem_status', ['draft', 'published', 'archived'])
export const localeEnum = pgEnum('locale', ['pt', 'es', 'en'])

export type TestCase = { input: JsonValue; expected: JsonValue; hidden: boolean }

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

export const problemsTable = pgTable('problems', {
  id: uuid('id').primaryKey().defaultRandom(),
  points: integer('points').notNull().default(100),
  difficulty: difficultyEnum('difficulty').notNull(),
  status: problemStatusEnum('status').notNull(),
  testCases: jsonb('test_cases').notNull().default([]).$type<TestCase[]>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const problemTranslationsTable = pgTable(
  'problem_translations',
  {
    problemId: uuid('problem_id')
      .notNull()
      .references(() => problemsTable.id, { onDelete: 'cascade' }),
    locale: localeEnum('locale').notNull(),
    title: text('title').notNull(),
    statementMd: text('statement_md').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.problemId, table.locale] })],
)
