# `kata verify` is blind to env-var name drift between config and consumers

**Found while**: #156 — renaming the SES credentials from `AWS_*` to `SES_*`
and documenting the production env vars.
**Where in kata**: `kata verify` (rule coverage), and the absence of any
config/env surface in the framework.

## What

The bug #156 fixes is that `back/src/config.ts` read `AWS_REGION` /
`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` while every real `back/.env`
(dev and the VPS) had always spelled them `SES_*`. The guard in
`notifications.service.ts` therefore never matched, password-reset OTPs went
to `console.log` instead of SES, and the route answered 204 either way — the
failure was invisible for months.

`kata verify --strict-coverage` was clean before and after the rename (61
files, no findings), which is correct — it has no notion of environment
configuration. Recording it as an observation, not a bug: kata has route
schemas, DI keys and middleware chains as first-class typed surfaces, but the
env surface is entirely userland (a hand-rolled zod `EnvSchema` plus
`process.loadEnvFile()`), so nothing in the framework can notice that a
declared optional var is never actually supplied anywhere.

Adjacent observation, this one about the userland pattern kata leaves open:
because `config.ts` calls `process.loadEnvFile()` at import time, a vitest
`setupFiles` that *deletes* the vars is useless — `loadEnvFile` refills any
name absent from `process.env`. Setting them to `''` works (Node does not
override a name that is present, even when empty). That is a Node semantic,
not a kata one, but any kata app doing env-parse-at-import will hit it the
moment a developer's real `.env` starts matching the code's names: our test
suite went from green to red *and started sending real email* purely because
the names finally lined up.

## Why it matters

The class of bug — a config key that nothing supplies, or supplies under
another name — is silent by construction and survives every gate kumite has:
typecheck (the value is legitimately `string | undefined`), `kata verify`,
unit tests (they mock the branch), and hurl (CI has no credentials, so the
fallback path is the tested path). Only a manual end-to-end send caught it.

A kata-side surface for "declared optional config that is never present in
any example/env file", or even a documented recipe for making the config
module test-overridable, would give consumers somewhere to stand. Not a
request — the honest summary is that this bug was outside everything kata
currently claims to check.

## Metrics

- **kata-docs MCP lookups: 0.** The task never needed one — the whole change
  is a rename in userland config, two docs files and a vitest setup file. No
  DI, JWT, route or error surface touched. Guessing was never on the table,
  so there is nothing to weigh a lookup against.
- **`kata verify` runs: 5** (2 manual, 3 via the pre-commit ladder), all
  clean, ~0.7–1.2s each. Cheap, and correctly silent here.
- **Gate ladder cost**: the two commits each ran the full ladder at ~95s and
  ~143s, dominated by the back suite (517 tests, ~60–85s) and the front suite
  (432 tests, ~25s) — a docs-only commit still pays the whole thing. Same
  observation already filed in
  `task-134-front-only-gate-ladder-runs-the-whole-back-suite.md`; recording
  the recurrence, not re-filing it.
- **Unrelated flake seen**: `password-reset.test.ts` failed twice in the full
  suite (`stops issuing once the IP is over its ceiling` timing out at
  vitest's default 5s, cascading into the argon2 call-count assertion) and
  passed in isolation and on re-run, on a machine at load average ~5–7. The
  test pays `PASSWORD_RESET_MAX_PER_IP` = 20 sequential argon2 hashes inside
  a 5s budget. Not kata's — noted here only so the numbers above are not read
  as a kata regression.
