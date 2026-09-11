# #177 implementation: a one-line drizzle fix, kata never in frame

**Found while**: implementing #177 (OTP reset was not clearing
`mustChangePassword`), `implementing-tasks`, 2026-09-11
**Where in kata**: nothing touched — `kata verify` only, as a gate

## What

The whole change was one field added to a drizzle `.set({...})` in a service
function, four unit tests, and three requests appended to an existing `.hurl`.
No route, schema, DI slot, middleware or error surface moved, so no kata API
had to be recalled and **zero `kata-docs` MCP queries** were made — the same
shape the planning entry for this task predicted
(`task-177-planning-drizzle-one-liner-kata-out-of-frame-mcp-absent-again.md`).

`kata verify --strict-coverage` ran clean (65 files) in ~2s as part of both
the manual ladder and the pre-commit hook. Nothing to report against it: it
was correct to stay quiet here, and it was cheap enough that its presence in
the ladder cost nothing worth noticing.

One thing worth recording on the hurl side, since it is a recurring shape
rather than a defect: the happy path of this bug is **not reachable from
hurl** at all. The plaintext OTP only exists inside the notification payload
(`notifications.service.ts`) and no route returns it, so the HTTP suite can
only anchor the *failure* path (wrong OTP ⇒ flag survives). The real
assertion had to live in vitest against the database. That is the right
security design and not something kata should change — but it does mean
"cover it in `.hurl`" is structurally impossible for any flow whose secret
travels out-of-band, and an agent following the `stack:back` evidence rule
literally will otherwise try and fail to write it.

## Why it matters

Two consecutive kumite tasks (#177 planning and now implementation) spent
nothing on kata-docs and lost nothing by it. The signal is not "the docs are
bad" — it is that a large share of kumite's remaining bug work is
drizzle/domain-shaped, sitting below the framework surface entirely. Worth
weighing before concluding from kumite's usage that kata-docs is
under-consulted.

## Metrics

- `kata-docs` MCP queries: **0**. Tokens spent on kata round-trips: **0** of
  the task's total.
- Turns spent on kata-related anything: 0 lookups; 2 gate invocations
  (`pnpm verify` manually, once more inside pre-commit).
- `kata verify --strict-coverage`: ~2.0s, 65 files, no findings. Full
  pre-commit ladder 171s, of which kata-verify was 1.98s — ~1%. Test
  execution (134s) dominates; kata is not the bottleneck in this loop.
- Did the harness catch anything real? No — but it also did not false-positive
  or add ceremony. Neutral, correctly.
- `pnpm hurl`: 15 files / 311 requests / 12.8s, green on the first run after
  a fresh `docker compose up -d` + migrate + seed in an isolated worktree
  (own `DB_PORT=5441`). No hurl friction this time — the known
  "not re-runnable without `down -v`" trap was avoided by seeding once,
  immediately before the run.

## Suggested fix (optional)

None for kata. If anything, a line in kumite's own `AGENTS.md` evidence rule
acknowledging that out-of-band-secret flows (OTP, email links) are
vitest-only by construction would save the next agent the detour — that is a
kumite doc change, not a kata one, so it is not filed here.
