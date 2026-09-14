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
  branches/PRs) in `docs/workflow.md`. Claude Code additionally wraps each
  step as a slash-command skill under `.claude/skills/` that imports the doc
  rather than duplicating it.
- Tasks are GitHub Issues (`gh`); format and labels in `docs/workflow.md`.

## Verify your work (from the repo root)

- `pnpm -r typecheck` — both packages; also proves the front↔back type contract.
- `pnpm verify` — `kata verify --strict-coverage` on `back/`.
- `pnpm -r test` — vitest in both packages.
- `pnpm format` — biome, single config at the root.
- Everything: `pnpm check`. Browser E2E: `pnpm --filter @kumite/front e2e`
  (boots back+front itself; `docker compose up -d` first for db-backed flows).

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

Whenever a kumite task touches the **kata framework** itself (not kumite
code) — the `kata-docs` MCP server, `kata verify`, hurl, the DI/JWT/error
surfaces, anything under `~/Projetos/kata` — attempt a report in
`kata-feedback/` at the repo root (format in `kata-feedback/README.md`).
This is not gated on finding something wrong: a plain observation, a
"this was smooth," or a metrics-only entry all count as useful signal — a
suggested fix is optional, never required. Do this instead of silently
moving on, and instead of expanding the current task's scope to fix kata
itself.

Where you have the numbers, include them: tokens/context spent on
kata-docs round-trips (searches + doc reads) versus the task's total, and
whether that lookup actually paid for itself versus guessing; turn-count or
latency friction (a slow `kata verify`, a doc dead end, a lint rule that
false-positived); and whether the kata-docs MCP or harness genuinely helped
this task or just added overhead.

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
