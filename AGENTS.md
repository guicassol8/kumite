# kumite — agent instructions

Canonical instructions for every agent on this repo. Claude Code imports this
from `CLAUDE.md`; Codex reads it natively.

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
- `docs/task-workflow/` — the canonical, agent-agnostic task process (create
  → pick → plan → implement → review); conventions (labels, worktrees,
  branches/PRs) in `docs/workflow.md`. `orchestrating-batch.md` runs 2–3
  issues from picking to merge in one session, delegating planning,
  implementation and review to a fresh subagent each. Codex
  discovers the thin wrappers in `.agents/skills/`; Claude Code uses
  `.claude/skills/`. Both read the same canonical docs rather than
  duplicating the process.
- Tasks are GitHub Issues (`gh`); format and labels in `docs/workflow.md`.

## Verify your work (from the repo root)

- `pnpm -r typecheck` — both packages; also proves the front↔back type contract.
- `pnpm verify` — `kata verify --strict-coverage` on `back/`.
- `pnpm -r test` — vitest in both packages.
- `pnpm format` — biome, single config at the root.
- Everything: `pnpm check`. Browser E2E: `pnpm --filter @kumite/front e2e`
  (boots back+front itself; `docker compose up -d` first for db-backed flows).
  Organizer flows need `ORGANIZER_EMAIL`/`ORGANIZER_PASSWORD` in the
  environment plus `db:seed`, and the reset-password happy path needs
  `BACK_NOTIFICATIONS_LOG`; without them those specs skip. Claude Code cloud
  sessions get all of it from `.claude/hooks/session-start.sh`. That hook's
  Postgres (5433) belongs to the main checkout: a worktree without its own
  `DB_PORT` stack shares it, so one whose migrations differ from the main
  checkout's needs its own stack (`docs/workflow.md` § Worktrees) — otherwise
  each side's tests fail against the other's schema.
- CI runs the full Browser E2E on every PR push (job `e2e`, one retry,
  report uploaded as the `playwright-report` artifact) — `docs/workflow.md`
  § Gate ladder.

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

When a kumite task **genuinely touches the kata framework** (not kumite
code) — a `defineRoute`/`defineMiddleware`/DI surface, the JWT or error
envelopes, a `kata verify` rule, the hurl conventions, `hc<AppType>` typing,
anything under `~/Projetos/kata` — and you learned something or hit
friction, write a report in `kata-feedback/` at the repo root (format and
the full rule in `kata-feedback/README.md`). A suggested fix is optional.
Never expand the current task's scope to fix kata itself.

When kata was **out of frame** (front-only, docs-only, a task where `kata
verify` merely ran and passed), do **not** write a report: append one line
to `kata-feedback/LEDGER.csv` instead. The old "attempt a report every
time" rule produced a hundred near-identical files (`kata-feedback/v2/`).

The `kata-docs` MCP server (`.mcp.json`) is optional: use it when it is
enabled in your session, otherwise read `~/Projetos/kata/docs` and the
bundled `.d.ts` directly. Its absence is not a finding and needs no
explanation.

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
