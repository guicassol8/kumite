import { defineMiddleware } from '../context'

// Example app-level middleware (ADR-0012): runs before every route's own use:
// chain. It logs the method + path of each request and provides no scoped slots.
// Wire app-level middleware in app.ts via createApp({ middlewares: [...] }).
export const requestLogger = defineMiddleware({
  provides: [],
  handler: async (c, next) => {
    const { method, path } = c.raw.req
    console.log('[req] ' + method + ' ' + path)
    await next()
  },
})
