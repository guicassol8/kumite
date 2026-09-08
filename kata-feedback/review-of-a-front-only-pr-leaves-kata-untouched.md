# Reviewing a front-only PR: `kata verify` is a fast, honest no-op — and the gate ladder still pays for the whole back suite

**Found while**: reviewing kumite #148 / issue #144 (global footer — a
**front-only** change)
**Where in kata**: `kata verify --strict-coverage`; the `kata-docs` MCP
server; the pre-commit gate ladder that wraps both.

## What

A review that touched no `back/` file at all still ran the full kata surface,
because the hooks run the ladder unconditionally. The observation is that
kata behaved exactly right and cost almost nothing:

- `kata verify --strict-coverage`: **0.73s**, "no problems found (60 files
  checked)", both when run standalone and inside the pre-commit hook. Zero
  false positives on a diff it has no business flagging.
- `kata-docs` MCP: **zero queries**. Nothing in the diff (a React component,
  three i18n catalogs, one Tailwind class on a route, a Playwright spec)
  raised a question kata could answer. No tokens spent, none wasted.
- hurl was correctly not needed — the PR declares no route, schema or error
  surface.

The one thing that cost real time during the review was **kumite-side**, and
worth recording only because it rhymes with the entry filed during this
task's implementation (`db-unreachable-fails-slow-and-loud-in-test-suite.md`):
the review worktree's Postgres was **up and migrated but never seeded**. The
e2e setup calls then failed with a plain `401 Invalid or expired token` from
`/auth/login`, three layers away from the cause. The previous entry asked for
a "is the database running?" preflight; this is the same class of problem one
step later — schema present, data absent — and a preflight that also answered
"…and does it have anything in it?" would have caught both.

## Why it matters

Mostly as positive signal: the common case for a kata consumer is a diff that
kata has no opinion about, and paying under a second for a confident "nothing
here for me" is the right price. Worth recording precisely because a report
folder that only ever collects complaints stops describing the framework.

## Metrics

- **kata-docs lookups this review: 0** — same as the implementation session.
  Two consecutive sessions on this task needed kata's docs zero times, which
  is the correct outcome for front-only work, not a gap in the docs.
- **`kata verify`: 0.73s / 0.73s** across two runs (standalone + pre-commit).
- **Gate ladder on the review's one commit**: 83s total — format 0.34s,
  typecheck 14.56s, kata-verify 0.73s, test 67.36s. kata's own share is
  under 1% of it; the back suite (422 tests, untouched by every line of this
  PR) is the bulk.
- **Cost of the unseeded DB**: 2 wasted Playwright runs (~45s each) plus the
  turns to trace a 401 back to a missing seed.

## Suggested fix (optional)

Nothing to fix in `kata verify`. The only carry-over is the preflight already
proposed in `db-unreachable-fails-slow-and-loud-in-test-suite.md`, widened one
notch: distinguish "cannot connect" from "connected, but the expected fixture
data is missing", so consumers get one clear line instead of an auth error
several layers downstream.
