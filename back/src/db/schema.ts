import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
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

export const teamsTable = pgTable(
  'teams',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('teams_lower_name_idx').on(sql`lower(${table.name})`)],
)

export const teamMembersTable = pgTable('team_members', {
  // PK on userId (not a composite/extra unique index) is what enforces
  // "1 team per user" — a user simply can't have a second row here.
  userId: uuid('user_id')
    .primaryKey()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id')
    .notNull()
    .references(() => teamsTable.id, { onDelete: 'cascade' }),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
})

export const eventConfigTable = pgTable(
  'event_config',
  {
    // Fixed to 1 — singleton row, enforced by the check constraint below.
    id: smallint('id').primaryKey().default(1),
    mixingLocked: boolean('mixing_locked').notNull().default(false),
    maxTeamSize: integer('max_team_size').notNull().default(3),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check('event_config_singleton', sql`${table.id} = 1`)],
)
