# `kata verify` reports "62 files checked" but is blind to back/scripts

**Found while**: reviewing PR #166 (issue #162 — HTML body for the
password-reset email)
**Where in kata**: `kata verify` (file discovery / `--strict-coverage`)

## What

PR #166 adds `back/scripts/preview-reset-email.ts` — real TypeScript that
imports `../src/config` and `../src/modules/notifications/notifications.service`
and is wired into a package script (`email:preview`). Nothing in the gate
ladder looks at it:

- `tsc --noEmit` skips it, because `back/tsconfig.json` has `include: ["src"]`
  (confirmed with `tsc --noEmit --listFiles | grep -c scripts/preview-reset-email.ts`
  → `0`);
- `kata verify --strict-coverage` passes with `✓ no problems found (62 files
  checked)` and never mentions it either.

So a file that imports two kata-adjacent modules can drift out of sync with
their signatures and every gate stays green. The kumite side of this is ours
to solve (tsconfig is a protected config here, and the user decided to accept
the gap rather than widen `include`) — the kata-side observation is narrower:
`kata verify`'s file count is scoped to the module tree, but its success line
reads like a whole-package verdict.

Not a bug — `kata verify` is a module-layout linter, and `back/scripts` is not
a module. The observation is about the **signal it gives the reader**: "no
problems found (62 files checked)" is easy to read as "this package is
covered," and there is no hint that TypeScript sources outside the module tree
were never in frame. A line naming what was excluded, or a `--strict-coverage`
note when package-local `.ts` files fall outside the scanned set, would close
the gap between what the command checks and what the reader thinks it checked.

## Why it matters

The whole point of the gate ladder is that green means "nothing rotted." Here
green is compatible with a broken helper. Any kata consumer that keeps
maintenance scripts next to (rather than inside) the module tree inherits the
same blind spot, and the reassuring file count actively discourages checking.

## Metrics

- **kata-docs MCP: not used at all this review.** The diff touched no kata
  API — no DI, no `c.error(...)`, no route/schema surface, no JWT. The one
  kata-shaped question ("does `kata verify` see `back/scripts`?") was answered
  by *running* `kata verify` and `tsc --listFiles` in ~2 turns, which is
  strictly cheaper and more trustworthy than any doc lookup could have been.
  Zero tokens spent on kata-docs round-trips; correctly zero.
- **`kata verify` latency: excellent.** 0.71–0.73s in the lefthook pre-commit
  ladder, twice, and sub-second standalone. It is the cheapest rung by two
  orders of magnitude (`test` was 74–76s in the same runs). Nothing to fix.
- **False positives: none.** `kata verify --strict-coverage` stayed clean
  across the original diff and both review commits, including one that added
  a named non-handler export (`renderPasswordResetEmail`) to a
  `*.service.ts` — a plausible spot for a layout linter to over-fire, and it
  correctly did not.
- **hurl: 14 files / 295 requests in ~5.9s, 100% green, run twice.** The only
  friction is the one already filed elsewhere in this folder — the suite is
  not re-runnable without a truncate + reseed first, and `ORGANIZER_*` must be
  exported into the shell because `back/.env` alone does not reach the `hurl`
  script's `--variable` interpolation. Both cost a turn each to rediscover.

## Suggested fix (optional)

Have `kata verify` say what it *didn't* look at when package-local `.ts` files
exist outside the scanned tree — e.g. `✓ no problems found (62 files checked;
1 .ts file outside the module tree not checked: scripts/preview-reset-email.ts)`.
Purely a reporting change; no new rule, no new failure mode.
