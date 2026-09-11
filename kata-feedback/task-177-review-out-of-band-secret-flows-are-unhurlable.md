# #177 review: kata was only a gate again — and hurl structurally cannot reach an out-of-band secret

**Found while**: reviewing PR #237 (OTP reset was not clearing
`mustChangePassword`), `reviewing-tasks`, 2026-09-11
**Where in kata**: nothing touched — `kata verify` and `hurl` as gates only

## What

Third consecutive #177 entry (planning, implementing, now review) where no
kata API moved and **zero `kata-docs` MCP queries** were needed. The diff is
one field added to a drizzle `.set({...})`, four vitest cases and three
requests appended to an existing `.hurl`. `kata verify --strict-coverage`
ran clean (65 files, ~1.5s) and correctly had nothing to say.

The one thing worth recording is a confirmation, from the reviewer's side, of
what the implementation entry
(`task-177-implementing-one-line-drizzle-fix-zero-docs-lookups.md`) predicted:
**the happy path of this bug is unreachable from hurl**. The plaintext OTP
only exists inside the notification payload; no route returns it, so a `.hurl`
file can assert the *failure* path only (wrong OTP ⇒ flag survives), which is
exactly what step 23b of `users.hurl` does.

But the review found the claim is narrower than it first reads, and the
distinction matters for anyone writing this rule down. With SES unconfigured
— the local and CI default — `notifications.service.ts` falls back to
`console.log`, so the OTP *is* observable, just not to hurl: it lands on the
API process's stdout, and hurl has no way to read a side channel. The
reviewer drove the full chain (organizer reset → `request-password-reset` →
scrape the OTP from the dev server log → `complete-password-reset` → login)
over plain curl and confirmed acceptance 1 and 2 at HTTP level, which the
`.hurl` suite by construction could not.

So the accurate statement is not "this flow has no HTTP-level test", it is
"**hurl cannot correlate two channels within one run**". Any flow whose
secret leaves by email, SMS or a log line is out of reach not because the
secret is unavailable but because hurl only ever sees response bodies.

## Why it matters

kumite's `stack:back` evidence rule reads "cover it in `.hurl`", and an agent
following it literally on an OTP/magic-link/email-confirmation flow will
spend turns trying to write a test that cannot exist, then quietly downgrade
to a failure-path assertion and call it covered. That is what happened here —
correctly handled, but only because the implementer noticed and wrote it
down.

For kata this is a capability observation, not a defect: a hurl-level hook
that could read a captured side channel (an injectable test transport, a
`--capture-from-file`, or a documented "last notification" test-only route
pattern) would close the gap. Equally defensible is for kata to say
explicitly that out-of-band flows belong in the unit layer — the value is in
saying *something*, since today the docs say neither and every consumer
rediscovers it.

## Metrics

- `kata-docs` MCP queries this review: **0**. Tokens on kata round-trips:
  **0** of the review's total.
- `kata verify --strict-coverage`: 65 files, no findings, ~1.5s.
- `pnpm hurl`: 15 files / 311 requests / 8.8s, green first run on a pristine
  `down -v` → `up -d` → migrate → seed. No hurl friction; the known
  "not re-runnable without a volume reset" trap was avoided by resetting
  immediately before the run.
- `pnpm -r test`: 1111 tests green (blocks 40, back 589, front 482), 135s.
- Did the harness catch anything real? No, and nothing to catch — but it also
  did not false-positive or add ceremony. Neutral, correctly, for the third
  time on this task.

## Suggested fix (optional)

For kata: a documented position on out-of-band-secret flows in the hurl
guide — either a side-channel capture mechanism or an explicit "these belong
in unit tests, assert the failure path in hurl". Either one saves the next
agent the detour.

Not filed here (kumite-scoped, for a human to decide): the same sentence
belongs in kumite's own `AGENTS.md` evidence rule.
