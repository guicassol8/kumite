import { cors } from '@katajs-framework/core'

import { createApp } from './context'
import { requestLogger } from './middlewares/request-logger'
import * as greetings from './modules/greetings/greetings.route'
import * as health from './modules/health/health.route'

// The application (AGENTS.md layout: app.ts === createApp). Modules are plain
// namespace imports — each file's exported routes are registered in order. The
// app-level middleware chain (ADR-0012) runs before every route; add
// cross-cutting concerns (cors(), secureHeaders(), bodyLimit() from 'kata') here.
export const app = createApp({
  modules: [health, greetings],
  middlewares: [cors(), requestLogger],
})

// The single artifact the front imports (type-only) to build its typed RPC
// client with hc<AppType> from 'hono/client' — see docs/tech-stack.md.
export type AppType = typeof app
