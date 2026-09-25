# cors() JSDoc does not say its options also drive the synthetic preflight

**Found while**: #273 (restrict CORS to APP_BASE_URL), planning
**Where in kata**: `@katajs-framework/core` `cors()` (dist/index.js `cors`, `recordPreflight`, `registerPreflightRoutes`), ADR-0020

## What

The `cors()` JSDoc says the options "mirror Hono's CORS options". It also says an app-level `cors()` gets a synthetic `OPTIONS <path>` route (ADR-0020). It does not say whether that preflight route uses the same `origin` allowlist. Answering "does a restricted `origin` also restrict preflights?" meant reading dist: `cors()` returns `preflight: options ?? {}`, and `registerPreflightRoutes` calls `honoCors({ ...entry.options, allowMethods })`. So yes, the same options apply, and only `allowMethods` is replaced by the path's real methods.

**Confirmed at implementation** (#273): `back/src/cors.test.ts` sends a preflight `OPTIONS /auth/login` through the real app with `cors({ origin: CORS_ORIGINS })`. An allowed origin gets 204 with `Access-Control-Allow-Origin` echoed and `authorization` in `Access-Control-Allow-Headers`. `https://evil.example` gets no `Access-Control-Allow-Origin`. Both cases were red against the old bare `cors()` (`*`) and are green now, so the dist reading holds for 0.4.2.

## Why it matters

Restricting `origin` is the first thing any production app does with `cors()`. If a reader suspects the preflight ignores the allowlist, they may add a second `cors()` or write a manual OPTIONS route.

## Metrics

- Planning: 0 kata-docs lookups (MCP not used). One read of the 0.4.2 dist answered the question. That read paid for itself: it removed a planned fallback (a second `cors()` or a manual OPTIONS route).
- Implementing: 0 lookups and 0 friction turns. `cors({ origin: string[] })` type-checked as is, with no spread needed. The preflight test passed on the first GREEN run.

## Suggested fix (optional)

Add one sentence to the `cors()` JSDoc: "The synthetic preflight reuses these options verbatim (only `allowMethods` is replaced by the path's registered methods)."
