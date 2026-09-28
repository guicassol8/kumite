# kumite — tech stack

Decisions made at terraform time (2026-08-25) with the user. Change only with a
task + user approval.

## Shape

pnpm monorepo. `back/` and `front/` stay deliberately decoupled (own
package.json, own typing); between them, the only cross-package artifact is a
**type**. The single sanctioned runtime exception is `blocks/` — the shared
Blockly block definitions both sides must agree on (approved 2026-08-25,
task #16).

| Package | What | Key deps |
|---|---|---|
| `back/` (`@kumite/back`) | API on **kata** (`@katajs-framework/core`, Hono-based) | hono ^4, zod **^3**, drizzle-orm + postgres, @hono/node-server |
| `front/` (`@kumite/front`) | React SPA | Vite, React 19, Tailwind v4 + shadcn/ui, TanStack Router (file-based) + Query, i18next, zod **^3**, react-hook-form |
| `blocks/` (`@kumite/blocks`) | Shared Blockly definitions: the "função com retorno" root block, the curated toolbox and the JS generators — consumed by the front editor and the back headless codegen | blockly |

## Front ↔ Back contract — typed RPC, zero codegen

- `back/src/app.ts` exports `export type AppType = typeof app`.
- `back/package.json` exposes it: `exports["."].types → ./src/app.ts`.
- `front/src/lib/api.ts` builds the client: `hc<AppType>(VITE_API_URL)`.
- No OpenAPI, no generated SDK (kata non-goal). Schema changes in back surface
  as **type errors** in front via `pnpm -r typecheck`.

## Constraints inherited from kata

- **zod pinned at ^3** in both packages (kata peer dependency).
- ESM-only; Node ≥ 20.
- Back follows kata's locked layout (`src/modules/<domain>/<domain>.{route,service,schema,test,hurl}.ts`),
  enforced by `kata verify` (13 rules) in hooks and pre-commit.
- `.hurl` E2E runs in CI (the `hurl` job, on a fresh migrated + seeded Postgres), not in the hooks.

## Infra

- Postgres 17 via `docker-compose.yml`, host port **5433** (5432 is taken by
  other local projects). Drizzle migrations in `back/drizzle/` (`pnpm --filter @kumite/back db:generate`).
- Env: `back/.env` (see `.env.example`); all values have local defaults.

## Decisions parked for their tasks

- **Judge sandbox**: candidates are quickjs-emscripten (WASM, safest/portable),
  isolated-vm (native), worker_threads + hard timeout (simplest). Decide in the
  judge task with a spike if needed.
- **Realtime**: SSE via Hono streaming (chosen direction); reevaluate WebSocket
  only if bidirectional needs appear.
- **Blockly**: decided (2026-08-25, epic #1) — official `blockly` npm package
  + our own thin React wrapper (#2); custom block definitions live only in
  `@kumite/blocks` (#16).
- **Deploy/hosting**: decided (2026-09-06, `back/docs/adr/0002-event-hosting.md`)
  — single VPS on GCP (`e2-small`, São Paulo) under the free trial, running
  the existing compose file plus Caddy as reverse proxy.
