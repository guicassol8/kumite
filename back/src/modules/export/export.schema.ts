import { z } from 'zod'

import { LocaleSchema } from '../../lib/locale'

import { DifficultySchema } from '../problems/problems.schema'
import { EventRankingSchema, RoundRankingSchema } from '../ranking/ranking.schema'
import { RoundStatusSchema } from '../rounds/rounds.schema'
import { OrganizerTeamMemberSchema, OrganizerTeamsListSchema } from '../teams/teams.schema'

// --- Event export DTOs (#278) ---
//
// One snapshot of everything the event produced, for certificates, prizes and
// the report to Mérida — and the readable half of the backup. Nothing here is
// stored: it is assembled per request from the very same services that serve
// /ranking, /rounds/:id/ranking and /organizer/teams, so the export can never
// disagree with what those screens show at that instant.
//
// Dates are `z.coerce.date()`, not `z.date()`: kata re-validates the output
// *after* JSON serialization, where a Date has already become an ISO string
// (same note as teams.schema.ts).

// A problem as it sat in a round. `letter` is its position rendered the way
// the UI and the CSVs name it (A, B, C…), so a row can be read without
// joining anything back.
export const ExportProblemSchema = z.object({
  problemId: z.string(),
  position: z.number().int().nonnegative(),
  letter: z.string(),
  points: z.number().int(),
  difficulty: DifficultySchema,
  // All three locales, not one: the export takes no `locale` parameter, so
  // the JSON stays lossless for whoever writes the report (the CSVs identify
  // a problem by `<round> <letter>` instead, which needs no translation).
  titles: z.array(z.object({ locale: LocaleSchema, title: z.string() })),
})

export const ExportRoundSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: RoundStatusSchema,
  openedAt: z.coerce.date().nullable(),
  closesAt: z.coerce.date().nullable(),
  closedAt: z.coerce.date().nullable(),
  problems: z.array(ExportProblemSchema),
})

// One (team, problem) pair that has at least one attempt — a pair with no
// submission is not a submission, so it is simply absent. `best*` is the
// attempt that counts under the ranking's own rule (highest score; a tie goes
// to the earliest acceptedAt), so these numbers reconcile with the leaderboard
// cell by cell.
export const ExportSubmissionSchema = z.object({
  teamId: z.string(),
  teamName: z.string(),
  roundId: z.string(),
  roundName: z.string(),
  problemId: z.string(),
  letter: z.string(),
  attempts: z.number().int().positive(),
  bestScore: z.number().int().nonnegative(),
  // The scale the best score was prorated over (#193) — null for a submission
  // judged before the stamp existed.
  bestMaxScore: z.number().int().nullable(),
  bestAcceptedAt: z.coerce.date(),
})

// Removed teams live in the JSON only (never in the ranking, never in the
// three CSVs): keeping them out is what makes the export agree with
// /leaderboard and /organizer/teams, and keeping them here is what stops the
// export from losing history.
//
// `membersWhoSubmitted`, deliberately not `members`: removeTeam deletes the
// team's `team_members` rows inside its transaction (teams.service.ts), so the
// roster of a removed team no longer exists anywhere — no query brings it
// back. What survives is `submissions`, ON DELETE RESTRICT precisely for this,
// carrying `userId` as an audit field. So this list is derived from the
// submissions and is partial by construction: whoever joined the team and
// never submitted left no trace. The submissions themselves are complete.
export const ExportRemovedTeamSchema = z.object({
  id: z.string(),
  name: z.string(),
  removedAt: z.coerce.date(),
  membersWhoSubmitted: z.array(OrganizerTeamMemberSchema),
  submissions: z.array(ExportSubmissionSchema),
})

export const EventExportSchema = z.object({
  generatedAt: z.coerce.date(),
  // Non-draft rounds only, oldest first by openedAt — a draft never announced
  // itself and cannot hold a submission.
  rounds: z.array(ExportRoundSchema),
  ranking: z.object({
    event: EventRankingSchema,
    rounds: z.array(RoundRankingSchema),
  }),
  teams: OrganizerTeamsListSchema,
  removedTeams: z.array(ExportRemovedTeamSchema),
  submissions: z.array(ExportSubmissionSchema),
})

// The three flat tables. `kind` is required on purpose (no `.default()`): an
// absent or empty `?kind=` is a 422, not a guessed "ranking" — same posture as
// the `teamId` of ListUsersQuerySchema.
export const ExportCsvKindSchema = z.enum(['ranking', 'teams', 'submissions'])

export const ExportCsvQuerySchema = z.object({
  kind: ExportCsvKindSchema,
})

// The body of `raw('text/csv', …)`: a CSV is a string, and that is the whole
// contract the RPC client needs to type `.text()` instead of `.json()`.
export const ExportCsvSchema = z.string()

export type ExportProblem = z.infer<typeof ExportProblemSchema>
export type ExportRound = z.infer<typeof ExportRoundSchema>
export type ExportSubmission = z.infer<typeof ExportSubmissionSchema>
export type ExportRemovedTeam = z.infer<typeof ExportRemovedTeamSchema>
export type EventExport = z.infer<typeof EventExportSchema>
export type ExportCsvKind = z.infer<typeof ExportCsvKindSchema>
export type ExportCsvQuery = z.infer<typeof ExportCsvQuerySchema>
