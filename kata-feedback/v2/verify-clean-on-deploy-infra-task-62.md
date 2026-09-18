# kata verify clean on a deploy/infra task (#62), db:migrate + db:seed exercised for real

**Found while**: #62, "Fazer o deploy do evento conforme o ADR do hosting" —
adds `back/Dockerfile`, `docker-compose.prod.yml`, `Caddyfile`,
`.github/workflows/deploy.yml`, an ADR amendment, and a deploy checklist.
No `back/src` route/service code changed.
**Where in kata**: `kata verify` (gate ladder step, ×3 commits), plus
`drizzle-kit migrate`/`db:seed` run for real against a throwaway Postgres
container built from the new production Docker image — not a kata-docs
lookup, but the DI/env surface kata's context wires up (`env.DATABASE_URL`,
`JWT_SECRET` in `back/src/config.ts`) is exactly what this task had to get
right for a container to boot correctly.

## What

Zero `kata-docs` MCP queries this task — nothing kata-API-shaped was
written or changed, so there was nothing to look up. `kata verify` ran
clean on every commit (3× across the gate ladder), correctly ignoring the
new root-level `Dockerfile`/`docker-compose.prod.yml`/`Caddyfile` and the
`.md` additions.

The one real friction point had nothing to do with kata itself: getting
`back/src/db/seed.ts`'s `argon2.hash()` call to actually run inside a
freshly built Docker image. `argon2`'s prebuilt native addon reliably
segfaults when loaded under Node 20 in a bare Debian container (both
`-slim` and full `bookworm`), confirmed by `process.dlopen`-ing the exact
same `.node` file directly — it loads fine under Node 22 in the identical
container. This blocked `db:seed` (which calls into `back/src/db/seed.ts`,
consuming the app's DI-resolved `Db` the same way any kata route/service
would) until the Dockerfile was pinned to `node:22-bookworm` instead of 20.
Not a kata bug — flagging here only because it's exactly the kind of "app
boots, DI resolves, then a dependency segfaults on the target runtime"
failure that would otherwise show up as a mysterious kata-framework issue
during an on-call/deploy incident if undiagnosed.

## Why it matters

Another clean "nothing to report" data point for `kata verify`'s
signal-vs-overhead tracking on an infra-only task. Also useful negative
evidence for anyone consuming kata-scaffolded apps in Docker: kata itself
(`defineContext`, `env.ts` parsing, `createApp`) had zero friction moving
from local dev/CI (Node 20 via `actions/setup-node`, not a bare container)
to a Docker image — the only incompatibility was argon2 vs. bare-container
Node 20, unrelated to the framework.

## Metrics

kata-docs MCP: 0 queries. `kata verify`: 0.66–0.69s each of 3 runs, all
clean. Full gate ladder (typecheck + kata-verify + test, 4 workspace
packages): ~60s each run, all green throughout. Extra turns spent
diagnosing the argon2/Node-20 segfault (strace, `process.dlopen` isolation,
cross-checking Node 22): a meaningful chunk of this session's total time —
but it paid for itself: shipping the original Node-20-based Dockerfile
untested would have produced a container that crashes on the very first
`db:seed`/login call once deployed to the real VPS.
