import { defineContext, scoped, singleton } from '@katajs-framework/core'

import { createDb } from './db/client'
import type { PublicUser } from './modules/users/users.schema'

// The typed dependency-injection surface for this app (ADR-0004). Register
// singleton(...) / scoped<T>() slots here as the app grows, then read them
// inside handlers and middleware with c.get('key').
export const k = defineContext({
  db: singleton(createDb()),
  currentUser: scoped<PublicUser>(),
})

// Re-export the bound factory so every module inherits this app's exact types:
// c.get('key') only compiles for keys registered above.
export const { defineRoute, defineMiddleware, createApp } = k

export type AppRegistry = typeof k.registry
