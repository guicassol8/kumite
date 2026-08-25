# Agent Instructions

Canonical instructions for every agent on this project. Codex loads this
file natively; Claude Code imports it from `CLAUDE.md`.

## Verify your work
- `kata verify` — fast deterministic checks; use `--json` for hook output, and
  `--strict-coverage` (what pre-commit runs) to fail on checks a rule could
  not prove — an unresolvable middleware in a chain, for instance.
- `pnpm test` — unit tests + Hurl E2E.
- `pnpm typecheck` — `tsc --noEmit`.

## Architectural decisions
This app's own decisions live as ADRs under `docs/adr/`; read the relevant
one before deviating. Kata's framework ADRs (why the framework itself works
this way) are at https://github.com/VicenzoMF/kata/tree/v0.3.2/docs/adr.

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

## Prohibitions
- Do not edit lint or framework configs to silence errors. Fix the code.
- Do not bypass git hooks — `--no-verify` is banned.
- Do not introduce request-scoped state outside the `scoped<T>()` slot mechanism.
