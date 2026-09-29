# kumite — agent instructions

Canonical instructions for this repo. Claude Code imports this from
`CLAUDE.md`.

kumite is the competitive block-programming platform for the PUCRS × Mérida
event. Product: `docs/product.md` · Stack decisions: `docs/tech-stack.md` ·
Task workflow: `docs/workflow.md` · Visual identity: `docs/design/identity.md`.

## Map

- `back/` — API on the **kata** framework (Hono). Has its own `AGENTS.md` with
  the mandatory module layout — read it before touching back code.
- `front/` — React SPA (Vite, TanStack, Tailwind v4 + shadcn). Own `AGENTS.md`.
- `blocks/` — `@kumite/blocks`: shared Blockly block definitions (root block,
  curated toolbox, JS generators) used by both `front/` (editor) and `back/`
  (headless codegen). The one sanctioned runtime cross-package exception
  (approved 2026-08-25, #16).
- `docs/design/` — visual identity, versioned and account-independent: spec
  (`identity.md`), tokens (W3C DTCG JSON + derived CSS), logo (SVG source, PNG
  built by `logo/export.sh`), image-generation prompts, canvas source files and
  a PNG per screen. Source of truth for the redesign epic (#214): screens follow
  the tokens, never the other way around.
- `docs/task-workflow/` — the canonical task process (create → pick → plan
  → implement → review); conventions (labels, worktrees, branches/PRs) in
  `docs/workflow.md`. `orchestrating-batch.md` runs 2–3 issues from picking
  to merge in one session, delegating planning, implementation and review
  to a fresh subagent each. The skills in `.claude/skills/` are thin
  wrappers that import these docs.
- Tasks are GitHub Issues (`gh`); format and labels in `docs/workflow.md`.

## Verify your work (from the repo root)

- `pnpm -r typecheck` — both packages; also proves the front↔back type contract.
- `pnpm verify` — `kata verify --strict-coverage` on `back/`.
- `pnpm -r test` — vitest in both packages.
- `pnpm format` — biome, single config at the root.
- Everything: `pnpm check`. Browser E2E: `pnpm --filter @kumite/front e2e`
  (boots back+front itself; a running Postgres first for db-backed flows).
  Organizer flows need `ORGANIZER_EMAIL`/`ORGANIZER_PASSWORD` in the
  environment plus `db:seed`, and the reset-password happy path needs
  `BACK_NOTIFICATIONS_LOG`; without them those specs skip. Claude Code cloud
  sessions get all of it from `.claude/hooks/session-start.sh`.
- The back suite never shares a database (#392): it runs against its own
  `<db>_test` (main checkout, CI) or `<db>_test_<worktree dir>`, created and
  migrated by its vitest globalSetup, so the tests never wipe an E2E's seed.
  The E2E, hurl and dev server do share `DATABASE_URL`'s database: a worktree
  whose migrations differ from the main checkout's needs its own database for
  those (`db:create`, `docs/workflow.md` § Worktrees, no Docker needed) —
  otherwise each side's E2E/hurl fails against the other's schema.
- `git push` runs the full ladder (lefthook pre-push, #399) whenever the push
  carries code, so it takes a few minutes — push with a long timeout, in the
  foreground. The Stop hook and CI are the other gates (`docs/workflow.md`
  § Gate ladder).
- CI on a PR push runs one job, `check` (format, typecheck, verify, tests).
  The full Browser E2E (`e2e`) and `hurl` run on push to `main` and on
  demand (`gh workflow run CI --ref <branch>`), not on every PR push: the
  reviewer runs them locally (#378) — `docs/workflow.md` § Gate ladder.

## Conventions

- pnpm only. From the root: `pnpm --filter @kumite/<pkg> <script>`.
- The front↔back contract is the typed RPC client (`hc<AppType>`): change a
  schema in `back/`, then run `pnpm -r typecheck` to surface front breakage.
  Never hand-write API types in `front/`.
- zod stays on **^3** in both packages (kata peer constraint).
- Blockly block definitions live ONLY in `@kumite/blocks` — never redefine a
  custom block or the toolbox inside `front/` or `back/`.
- Conventional commits (`feat:` `fix:` `chore:` `test:` `docs:` `refactor:`) —
  always, on every commit, no exceptions.
- `develop` is the integration branch: every task lives on a branch
  `task/<issue>-<slug>` cut from `develop`, and lands via PR into `develop`
  (`Fixes #N` + Evidence). Never commit directly on `main` or `develop`.
  `main` only moves when the user explicitly asks for a release, which always
  bumps the version — see `docs/workflow.md` § Releases.
- **Always work inside a dedicated git worktree, never in the main checkout** —
  more than one agent may be working on this repo at the same time. See
  `docs/workflow.md` § Worktrees for the commands and cleanup.
- Every user-visible string exists in the three i18n catalogs (pt/es/en) —
  the parity test fails otherwise.
- Every interactive element gets a `data-testid`.

## Kata framework feedback

The one place for this rule — every step doc points here instead of
repeating it.

**Reading kata's docs.** Never guess a kata API shape (routes, middleware,
DI, verify rules, the JWT and error envelopes). Use the `kata-docs` MCP
server (`.mcp.json`) when it is enabled in your session. Otherwise read the
installed package under `back/node_modules/@katajs-framework/core`: the
JSDoc in its `dist/**/*.d.ts` for the API (its `README.md` is only a
quickstart that links kata's ADRs), and
`pnpm --filter @kumite/back exec kata verify --help` for every verify rule
and its ADR — plus a local checkout of the kata repo, on a machine that has
one. The MCP's absence is not a finding and needs no explanation.

**Reporting.** When a kumite task **genuinely touches the kata framework**
(not kumite code) — a `defineRoute`/`defineMiddleware`/DI surface, the JWT
or error envelopes, a `kata verify` rule, the hurl conventions,
`hc<AppType>` typing, kata's own code — and you learned something or hit
friction, write a report in `kata-feedback/` at the repo root (format and
the full rule in `kata-feedback/README.md`). A suggested fix is optional.
Never expand the current task's scope to fix kata itself.

When kata was **out of frame** (front-only, docs-only, a task where `kata
verify` merely ran and passed), do **not** write a report: append one line
to `kata-feedback/LEDGER.csv` instead. The old "attempt a report every
time" rule produced a hundred near-identical files (`kata-feedback/v2/`).
Each step (planning, implementing, reviewing) that ran adds its own line or
report before its handoff.

Where you have the numbers, include them in the report or the ledger:
docs lookups made and whether they paid for themselves, `kata verify` runs
and real findings, turns lost to kata friction.

This is separate from "Discovered work" (`docs/workflow.md`): that flow
opens a kumite GitHub issue for kumite-scoped work; kata feedback is not
kumite-scoped, so it goes to this local folder for a human to triage
against the kata repo.

## Prohibitions

- Never bypass hooks: no `--no-verify`, no `-n`, no `SKIP=` (also denied in
  settings). A blocking hook is a real failure — fix the cause.
- Never edit protected configs (tsconfig*, biome.json, lefthook.yml,
  pnpm-lock.yaml, pnpm-workspace.yaml, `.github/workflows/`,
  `.claude/settings.json`) unless the user explicitly asks.
- Never invent API shapes — `back/` is the source of truth via `AppType`.
- Never edit generated files (`front/src/routeTree.gen.ts`, `back/drizzle/`).
