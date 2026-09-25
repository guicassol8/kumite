import { bodyLimit, cors } from '@katajs-framework/core'

import { APP_MAX_BODY_BYTES, CORS_ORIGINS } from './config'
import { createApp } from './context'
import { requestLogger } from './middlewares/request-logger'
import * as auth from './modules/auth/auth.route'
import * as bugReports from './modules/bug-reports/bug-reports.route'
import * as eventCodes from './modules/event-codes/event-codes.route'
import * as eventConfig from './modules/event-config/event-config.route'
import * as eventExport from './modules/export/export.route'
import * as health from './modules/health/health.route'
import * as passwordReset from './modules/password-reset/password-reset.route'
import * as problems from './modules/problems/problems.route'
import * as ranking from './modules/ranking/ranking.route'
import * as rounds from './modules/rounds/rounds.route'
import * as sse from './modules/sse/sse.route'
import * as stats from './modules/stats/stats.route'
import * as submissions from './modules/submissions/submissions.route'
import * as teams from './modules/teams/teams.route'
import * as users from './modules/users/users.route'

// The application (AGENTS.md layout: app.ts === createApp). Modules are plain
// namespace imports — each file's exported routes are registered in order. The
// app-level middleware chain (ADR-0012) runs before every route; add
// cross-cutting concerns (cors(), secureHeaders(), bodyLimit() from 'kata') here.
// Exported, not inlined below, so the cross-module suites can walk every
// registered route — src/auth-guards.test.ts for the `requirePasswordUpToDate`
// convention (ADR-0004), src/app.test.ts for the closed list of routes that
// answer without a token (#188) — without keeping a second copy of this list
// to drift out of date.
// `as const` is load-bearing, not decoration: without it the array widens to a
// union and `AppType` collapses, taking the front's whole typed RPC client down
// with it (every `api.*` becomes `unknown`).
export const modules = [
  health,
  auth,
  users,
  passwordReset,
  problems,
  eventConfig,
  eventCodes,
  teams,
  submissions,
  rounds,
  ranking,
  stats,
  eventExport,
  sse,
  bugReports,
] as const

// bodyLimit runs app-wide (#287): the public routes had no ceiling at all, so
// the first thing every request meets is a size check. A route may still be
// stricter — submissions keeps its own SUBMISSION_MAX_BODY_BYTES in `use:`,
// and the smaller of the two is what applies there.
// cors() answers only the allowlist (#273): the front's APP_BASE_URL plus the
// local dev front (config.ts CORS_ORIGINS). Any other Origin gets no
// Access-Control-Allow-Origin, so a browser on another site cannot read the
// answer. The same options drive kata's synthetic preflight (ADR-0020), so
// OPTIONS is restricted too — src/cors.test.ts pins both.
export const app = createApp({
  modules,
  middlewares: [
    cors({ origin: CORS_ORIGINS }),
    bodyLimit({ maxSize: APP_MAX_BODY_BYTES }),
    requestLogger,
  ],
})

// The single artifact the front imports (type-only) to build its typed RPC
// client with hc<AppType> from 'hono/client' — see docs/tech-stack.md.
export type AppType = typeof app
