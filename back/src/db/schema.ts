import { asc, desc, sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
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
export const roundStatusEnum = pgEnum('round_status', ['draft', 'open', 'closed'])
export const submissionCaseStatusEnum = pgEnum('submission_case_status', [
  'passed',
  'failed',
  'timeout',
  'error',
])

export type TestCase = { input: JsonValue; expected: JsonValue; hidden: boolean }

// Explicit `index`, not a positional array: a submission's results stay
// readable even if a problem's test cases are reordered later.
export type SubmissionCaseResult = {
  index: number
  status: (typeof submissionCaseStatusEnum.enumValues)[number]
}

export const usersTable = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: roleEnum('role').notNull(),
    university: universityEnum('university').notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('users_lower_email_idx').on(sql`lower(${table.email})`)],
)

// One pending OTP per user (userId as PK, like team_members) — a new
// organizer-triggered reset upserts and replaces any pending row.
export const passwordResetOtpsTable = pgTable('password_reset_otps', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  otpHash: text('otp_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  attemptsRemaining: smallint('attempts_remaining').notNull().default(5),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const passwordResetActionEnum = pgEnum('password_reset_action', ['request', 'complete'])

// Append-only log backing the sliding-window throttle on the two public
// password-reset routes (#142). Deliberately has no FK to `users`: the whole
// point is to count attempts against addresses that may not exist, since
// those are exactly the ones an enumeration sweep uses. Rows older than the
// window are deleted opportunistically on the next request.
export const passwordResetRequestsTable = pgTable(
  'password_reset_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    action: passwordResetActionEnum('action').notNull(),
    emailKey: text('email_key').notNull(),
    ip: text('ip').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('password_reset_requests_email_idx').on(table.action, table.emailKey, table.createdAt),
    index('password_reset_requests_ip_idx').on(table.action, table.ip, table.createdAt),
    index('password_reset_requests_created_at_idx').on(table.createdAt),
  ],
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
    // Owned by #31 until #18/#21 land a real `submissions` table and take
    // over setting it; a set value freezes the team's membership (leave route).
    firstSubmittedAt: timestamp('first_submitted_at', { withTimezone: true }),
    // Set by the organizer's removeTeam (#50) instead of a real delete:
    // submissions.teamId is ON DELETE RESTRICT and submissions must survive
    // for audit even though the team drops out of every listing/ranking.
    removedAt: timestamp('removed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Partial, not plain unique: a removed team's name must be immediately
    // reusable (same pattern as rounds_single_open_idx).
    uniqueIndex('teams_lower_name_idx')
      .on(sql`lower(${table.name})`)
      .where(sql`${table.removedAt} IS NULL`),
  ],
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

export const roundsTable = pgTable(
  'rounds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    status: roundStatusEnum('status').notNull().default('draft'),
    durationMinutes: integer('duration_minutes').notNull(),
    openedAt: timestamp('opened_at', { withTimezone: true }),
    closesAt: timestamp('closes_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // No máximo 1 rodada com status = 'open': todas as linhas "open" indexam
    // a mesma chave constante, então uma segunda colide.
    uniqueIndex('rounds_single_open_idx').on(sql`(true)`).where(sql`${table.status} = 'open'`),
  ],
)

export const roundProblemsTable = pgTable(
  'round_problems',
  {
    roundId: uuid('round_id')
      .notNull()
      .references(() => roundsTable.id, { onDelete: 'cascade' }),
    problemId: uuid('problem_id')
      .notNull()
      .references(() => problemsTable.id, { onDelete: 'restrict' }),
    position: integer('position').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.roundId, table.problemId] }),
    uniqueIndex('round_problems_round_id_position_idx').on(table.roundId, table.position),
  ],
)

export const submissionsTable = pgTable(
  'submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    problemId: uuid('problem_id')
      .notNull()
      // restrict: a problem with submission history can't be deleted — the
      // scores would lose their meaning (same rule as round_problems).
      .references(() => problemsTable.id, { onDelete: 'restrict' }),
    // userId is an audit field ("who on the team submitted"); teamId is the
    // identity that scoring and the leaderboard group by. Both mandatory:
    // every submission belongs to an authenticated participant with a team.
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'restrict' }),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teamsTable.id, { onDelete: 'restrict' }),
    workspace: jsonb('workspace').notNull().$type<JsonValue>(),
    generatedCode: text('generated_code').notNull(),
    caseResults: jsonb('case_results').notNull().default([]).$type<SubmissionCaseResult[]>(),
    score: integer('score').notNull(),
    attemptNumber: integer('attempt_number').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Guards the attempt-numbering race #21's insert would otherwise have to
    // own alone.
    uniqueIndex('submissions_team_problem_attempt_idx').on(
      table.teamId,
      table.problemId,
      table.attemptNumber,
    ),
    // Serves getBestSubmission: highest score first, earliest wins a tie.
    index('submissions_team_problem_score_idx').on(
      table.teamId,
      table.problemId,
      desc(table.score),
      asc(table.createdAt),
    ),
  ],
)
