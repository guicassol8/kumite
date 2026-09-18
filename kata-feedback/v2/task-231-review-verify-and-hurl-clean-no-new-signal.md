# kata verify/hurl behaved cleanly on review of #231 — no new signal

**Found while**: #255 (reviewing-tasks), review of the password-reset email
identity/locale PR
**Where in kata**: `kata verify --strict-coverage`, `hurl`

## What

Re-ran the full gate ladder against the PR's diff (`notifications.service.ts`
now folded to 402 lines per the ADR-0018 constraint already reported in
`task-231-implementing-schema-file-naming-blocked-approved-plan.md`):
`kata verify --strict-coverage` passed clean (65 files) despite the larger
service file, and `hurl` passed 15/15 files, 321 requests once the local
Postgres/env setup was correct. No new kata-side friction beyond what the
implementing session already reported — the schema-file-naming constraint is
the whole story for this task.

## Why it matters

Confirms the implementer's report holds under a second, independent
`kata verify` run against the same file layout: the rule's rejection of
`notifications.locales.ts`/`kumite-mark.ts` as separate files (and its
tolerance of the resulting 400+ line single-file fallback) is consistent
behavior, not a one-off. No action needed here — filed mainly so a human
triaging the earlier report knows the workaround verified clean on review
too.

## Metrics

Zero kata-docs MCP lookups (tool not available this session either, same as
prior reports). All friction in this review was kumite-side (worktree
Postgres/env setup for hurl, not kata itself).

## Suggested fix

None beyond what `task-231-implementing-schema-file-naming-blocked-approved-plan.md`
already suggested (surface schema-file-naming's exact suffix allowlist during
planning, before file names are chosen).
