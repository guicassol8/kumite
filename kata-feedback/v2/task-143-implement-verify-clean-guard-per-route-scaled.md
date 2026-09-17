# Implementing #143: `guard()` scaled to 39 routes, verify clean, zero docs lookups

**Found while**: implementing #143 (organizer-driven password reset with
step-up, plus a `must_change_password` block on every authenticated route)
**Where in kata**: `guard()` / `defineMiddleware`, `kata verify --strict-coverage`, hurl runner

## What

Mostly a "this was smooth" entry, with one sharp edge that is not kata's bug
but is worth recording because kata's design is what made it visible.

The task's heaviest kata surface was applying a new `requirePasswordUpToDate`
middleware — a plain `guard()` on `user.mustChangePassword` — to **39
authenticated routes** across 10 modules, with two deliberate exemptions
(`GET /me` and `POST /auth/change-password`, the escape valves). Nothing about
that fought back: `defineMiddleware` + `guard()` composed with the existing
`requireUser` / `requireOrganizer` chain exactly as expected, and
`kata verify --strict-coverage` stayed clean across all 61 files without a
single false positive, including on the new route that declares
`output: { 200, 403, 404 }` where the 401/403 from middleware short-circuits
are intentionally undeclared.

The sharp edge is one kata's API shape forces the consumer to own: a per-route
`use:` list is **fail-open for routes added later**. Forget the middleware on a
new route and nothing complains — not the compiler, not `verify`. We paid for
it with a guardrail test that walks the exported module list and asserts every
`requireUser` route also carries `requirePasswordUpToDate` unless it is on an
explicit allowlist, plus an ADR explaining why we did not wrap `requireUser`
instead (a hand-composed handler is precisely the chain `--strict-coverage`
cannot resolve, so wrapping would have traded a fail-open list for a verify
blind spot).

That trade is real and we chose kata's grain deliberately, but it is the kind of
thing a framework could help with: some way to declare "this middleware is
required on any route matching X" — a default `use:` at the module or app level
that a route must explicitly opt out of — would make the safe thing the default
instead of a convention a test has to police.

**Zero `kata-docs` MCP queries this task.** The planning session had already
answered the framework questions (its own entry records the MCP being down and
the `.d.ts` answering instead), so implementation ran entirely off the existing
codebase idioms. For a task this framework-heavy, that is a good sign about how
learnable the surface is once you have one working example to copy.

## Why it matters

For kata: the `guard()`/`defineMiddleware` surface scaled to a cross-cutting
concern over 39 routes with no friction and no verify noise — worth knowing
that it holds at that size. The gap is the absence of any "apply this to
everything authenticated" primitive, which pushes every consumer that needs a
cross-cutting guard into either a fail-open list or a verify blind spot.

For kumite: the convention now lives in ADR-0004 and a guardrail test rather
than in anyone's memory.

## Metrics

- **kata-docs MCP**: 0 queries, 0 docs read, 0 tokens. Not needed — no dead
  ends either, so this is not a complaint about the docs.
- **`kata verify`**: ~0.9s per run, clean every time (61 files). Ran on every
  back edit via the PostToolUse hook and twice in the pre-commit ladder; never
  once blocked or false-positived. Cheapest gate in the ladder by a wide margin
  (typecheck ~20s, tests ~100s).
- **hurl**: the `users.hurl` block for the new route (48 requests) passed
  first try against a live server; whole suite 14/14 files, 293 requests, ~7s.
  The recurring tax is not kata's runner but the suite's **non-re-runnability**:
  every file starts by signing up fixtures, so a second run without a
  `truncate` + `db:seed` fails at request 1 in 10 of 14 files. Cost this task:
  three wasted hurl runs (~4 turns) before resetting the database. A
  `--reset` hook or a documented "hurl assumes a clean DB" note in the runner's
  output would have saved all of them.
- **Harness friction, not kata**: the pre-commit gate ladder is where the real
  time went — ~2min per commit, and the full Playwright suite OOM-killed the
  machine once (7GB box, 2 Chromium workers each holding a Blockly workspace).
  Re-running it with `--workers=1` passed 50/50.
