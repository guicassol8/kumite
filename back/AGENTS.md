# Agent Instructions

Canonical instructions for every agent on this project. Codex loads this
file natively; Claude Code imports it from `CLAUDE.md`.

## Verify your work
- `kata verify` — fast deterministic checks; use `--json` for hook output, and
  `--strict-coverage` (what pre-commit runs) to fail on checks a rule could
  not prove — an unresolvable middleware in a chain, for instance.
- `pnpm test` — unit tests (Vitest). They run against their own database,
  `<db>_test` (`<db>_test_<worktree dir>` in a linked worktree), derived
  from `DATABASE_URL` and created + migrated by `src/db/test-global-setup.ts`;
  `TEST_DATABASE_URL` overrides it (#392). `pnpm db:create` creates the
  `DATABASE_URL` database itself when it does not exist (local only).
- `pnpm hurl` — API E2E via Hurl; CI runs it on `main` and on demand, not
  on PR pushes (#378), so the reviewer runs it locally. Run
  `pnpm db:reset` first: the suite asserts on seed state and is not
  re-runnable on a dirty database. `db:reset` truncates every table and
  re-seeds; it refuses any `DATABASE_URL` that is not local. It resets the
  database, not the process: the bug-report and password-reset windows are
  in-memory, so restart the server too before a second run (or wait out
  `BUG_REPORT_COOLDOWN_MS`).
- `pnpm typecheck` — `tsc --noEmit`.

## Architectural decisions
This app's own decisions live as ADRs under `docs/adr/`; read the relevant
one before deviating. Kata's framework ADRs (why the framework itself works
this way) are at https://github.com/VicenzoMF/kata/tree/katajs-v0.4.2/docs/adr.

## Mandatory folder layout
```
src/
├── app.ts                # createApp({ context, modules })
├── context.ts            # defineContext({ ... })
├── middlewares/
└── modules/<domain>/
    ├── <domain>.route.ts     # defineRoute calls only
    ├── <domain>.service.ts   # pure functions
    ├── <domain>.schema.ts    # Zod schemas (DTOs)
    ├── <domain>.hurl         # API E2E
    └── <domain>.test.ts      # unit tests
```

## Conventions
- Functional only — no classes, no decorators.
- Named exports only — no default exports.
- `any` is forbidden — use `unknown` + narrowing.
- Schemas live in `<domain>.schema.ts`, never inline in `.route.ts`.
- Every route declares `input` and `output` schemas.
- DI: `c.get('key')` only compiles if `'key'` is in `defineContext`.
- Every authenticated route uses `use: [requireUser, requirePasswordUpToDate, ...]`.
  The two exemptions and the test that enforces the rule live in
  `src/auth-guards.test.ts` — see ADR-0004.

## Prohibitions
- Do not edit lint or framework configs to silence errors. Fix the code.
- Do not bypass git hooks — `--no-verify` is banned.
- Do not introduce request-scoped state outside the `scoped<T>()` slot mechanism.
