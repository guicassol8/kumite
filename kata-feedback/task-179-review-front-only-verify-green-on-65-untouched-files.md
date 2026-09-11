# Review of a front-only PR: `kata verify` was the only kata surface, and it had nothing to check

**Found while**: reviewing PR #243 (issue #179) — session hydration retries
after a failed `GET /me`. Front-only diff.
**Where in kata**: `kata verify --strict-coverage` (via `pnpm verify`);
`kata-docs` MCP not consulted.

## What

Plain observation, no bug, and a near-duplicate of what the implementing
session already recorded for this same issue — which is itself the signal.

The reviewed diff is 22 files, all under `front/` plus one `kata-feedback/`
entry. No route, no schema, no migration, no DI, no error surface. Stage 2 of
the review asks for kata idioms in `back/` (schemas in `.schema.ts`,
`c.error(...)`, pure services) and there was simply no `back/` to read.

`pnpm verify` ran once here and reported `no problems found (65 files
checked)` — the same 65 untouched files the implementing session verified four
times. Correct, fast (~2s), and still a no-op: nothing in the reviewed commit
range can change that answer.

The one kata-shaped decision in the diff was inherited, not discovered: `/me`
declares only `output: PublicUserSchema`, so `res.status` narrows to the
literal `200` and the front has to widen it (`const status: number =
res.status`) before comparing against `401`/`403`. Reviewing that line needed
zero docs lookups — #174 had already paid for the answer and the code carries a
comment pointing at it. That is the docs-lookup economy working as intended:
the cost was paid once, written down, and amortised across at least three
later sessions.

## Why it matters

- A review skill that mandates a kata-idiom pass will keep hitting front-only
  PRs where that pass is vacuous. "Not applicable" is the honest verdict and
  worth recording as data, not something to manufacture a finding for.
- It reinforces the implementing session's suggestion from a second angle:
  `kata verify` reporting a no-op when nothing under its project root changed
  would make the review ladder's output say something. Right now a green
  `65 files checked` on a front-only branch reads as evidence when it is
  really silence.
- Counter-signal worth stating plainly: the widened-`res.status` comment is
  the *only* reason this review did not need the MCP. Durable in-code
  breadcrumbs pointing at the task that established a kata workaround are
  cheaper than any docs lookup, and kata could encourage that pattern
  explicitly (e.g. a documented idiom for consuming a single-status `output`
  from `hc`).

## Metrics

- kata-docs MCP: **0 queries, 0 docs read, 0 tokens**. Not consulted; the MCP
  server was also listed as still connecting at session start and never
  needed.
- `kata verify`: 1 run, 65 files, green, ~2s. Zero findings, zero false
  positives, zero files in the diff within its scope.
- Review gate ladder total: `pnpm -r typecheck` (3 projects, green),
  `pnpm -r test` (51 + 601 + 512 tests, green, ~96s wall), `pnpm verify`
  (~2s), Playwright spec (2 tests, 14.2s). kata accounted for ~2% of the
  wall-clock and 0% of the findings.
- Turns lost to kata friction: **0**. Turns lost to environment friction
  (docker host-port collisions across five live worktree Postgres instances,
  two attempts to find a free port): **2** — not kata's doing, recorded only
  so the kata numbers above are not mistaken for the whole cost.

## Suggested fix (optional)

None required. Seconding the implementing session's one idea: a changed-files
(or content-hash) short-circuit so `kata verify` can report "no back files
changed" instead of a green count that means nothing on a front-only branch.
