import { cors } from '@katajs-framework/core'

import { createApp } from './context'
import { requestLogger } from './middlewares/request-logger'
import * as auth from './modules/auth/auth.route'
import * as bugReports from './modules/bug-reports/bug-reports.route'
import * as eventCodes from './modules/event-codes/event-codes.route'
import * as eventConfig from './modules/event-config/event-config.route'
import * as greetings from './modules/greetings/greetings.route'
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
// Exported, not inlined below, so src/auth-guards.test.ts can walk every
// registered route and assert the `requirePasswordUpToDate` convention
// (ADR-0004) without keeping a second copy of this list to drift out of date.
// `as const` is load-bearing, not decoration: without it the array widens to a
// union and `AppType` collapses, taking the front's whole typed RPC client down
// with it (every `api.*` becomes `unknown`).
export const modules = [
  health,
  greetings,
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
  sse,
  bugReports,
] as const

export const app = createApp({
  modules,
  middlewares: [cors(), requestLogger],
})

// The single artifact the front imports (type-only) to build its typed RPC
// client with hc<AppType> from 'hono/client' — see docs/tech-stack.md.
export type AppType = typeof app
