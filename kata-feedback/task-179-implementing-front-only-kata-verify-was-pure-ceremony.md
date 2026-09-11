# Front-only session bug: kata never in frame, `kata verify` ran four times for nothing

**Found while**: #179 — implementing the fix for a session that hangs on
`'loading'` after a failed `GET /me` (front-only).
**Where in kata**: `kata verify` (via `pnpm verify` / `pnpm check` / the
pre-commit ladder); `kata-docs` MCP not consulted.

## What

Plain observation, no bug. The whole task lived in `front/src/lib/session.ts`,
`route-guards.ts`, `__root.tsx`, the header, the login route and the three i18n
catalogs. Zero lines of `back/` changed, no route added, no schema touched, no
migration — so kata was out of frame from the first step to the last.

The one place kata *did* show up is the gate ladder: `kata verify
--strict-coverage` ran on every `pnpm verify`, every `pnpm check` and every
pre-commit, four times in this session, each time on 65 unchanged back files,
each time green. Correct behaviour, and cheap (a couple of seconds), but it is
pure ceremony on a front-only branch.

One kata-adjacent detail did matter, and it was already known from #174: the
`/me` route declares only `output: PublicUserSchema`, so `res.status` types as
the literal `200` and comparing it to `401` is a TS2367. The fix (widen on the
client with `const status: number = res.status`) came straight out of the plan
— no docs lookup needed, because a previous task had already paid for that
answer and it was written down.

## Why it matters

Two small signals, both about cost rather than correctness:

- The "did kata-docs help?" question has no answer here, because there was
  nothing to ask. That is itself the useful datum: a front-heavy repo will
  keep producing tasks where the MCP server is dead weight, and the honest
  report is "not consulted", not a forced lookup.
- `kata verify` has no cheap way to say "nothing under `back/` changed, this
  is a no-op". On a monorepo where most task branches touch only `front/`, a
  changed-files short-circuit would remove a few seconds from every commit and,
  more importantly, remove a step from the mental model of what the ladder is
  actually checking.

## Metrics

- kata-docs MCP: **0 queries, 0 docs read, 0 tokens**. Nothing in the task
  reached a kata surface that would have needed one.
- `kata verify`: 4 runs (`pnpm verify` once, `pnpm check` once, plus the
  pre-commit ladder), 65 files each, all green, ~2s each. Zero findings, zero
  false positives.
- Turns lost to kata friction: **0**.
- The task's real friction was elsewhere and worth recording for contrast: one
  red-test debugging detour (~4 turns) chasing a vitest fake-timer deadlock
  that turned out to be correct production behaviour — a route guard
  re-attempting hydration from the error state — and one e2e failure that
  exposed a genuine UX bug (the retry flipped the status to `'loading'`,
  unmounting the card it was rendered inside). Both were caught by the
  project's own tests, neither by kata.

## Suggested fix (optional)

Optional and low priority: let `kata verify` skip (or report as a no-op) when
no file under its project root changed since the last successful run — a
content hash of the scanned set would do. Everything else here is an
observation, not a request.
