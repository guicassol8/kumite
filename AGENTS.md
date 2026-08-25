# kumite — agent instructions

Canonical instructions for every agent on this repo. Claude Code imports this
from `CLAUDE.md`; Codex reads it natively.

kumite is the competitive block-programming platform for the PUCRS × Mérida
event. Product: `docs/product.md` · Stack decisions: `docs/tech-stack.md` ·
Task workflow: `docs/workflow.md`.

## Map

- `back/` — API on the **kata** framework (Hono). Has its own `AGENTS.md` with
  the mandatory module layout — read it before touching back code.
- `front/` — React SPA (Vite, TanStack, Tailwind v4 + shadcn). Own `AGENTS.md`.
- `.claude/skills/` — the five task-workflow skills
  (create → pick → plan → implement → review).
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
- Conventional commits; branches `task/<issue>-<slug>`; PRs `Fixes #N` + Evidence.
- Every user-visible string exists in the three i18n catalogs (pt/es/en) —
  the parity test fails otherwise.
- Every interactive element gets a `data-testid`.

## Prohibitions

- Never bypass hooks: no `--no-verify`, no `-n`, no `SKIP=` (also denied in
  settings). A blocking hook is a real failure — fix the cause.
- Never edit protected configs (tsconfig*, biome.json, lefthook.yml,
  pnpm-lock.yaml, pnpm-workspace.yaml, `.github/workflows/`,
  `.claude/settings.json`) unless the user explicitly asks.
- Never invent API shapes — `back/` is the source of truth via `AppType`.
- Never edit generated files (`front/src/routeTree.gen.ts`, `back/drizzle/`).
