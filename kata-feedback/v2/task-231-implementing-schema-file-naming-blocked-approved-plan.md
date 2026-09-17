# schema-file-naming rejected the approved plan's file layout

**Found while**: #231 (implementing-tasks), password-reset email redress
**Where in kata**: `packages/verify/src/rules/schema-file-naming.ts` (ADR-0018)

## What

The approved plan for #231 called for two new files inside
`back/src/modules/notifications/`: `notifications.locales.ts` (a pt/es/en
copy table) and `kumite-mark.ts` (a base64 image constant). Both are
reasonable, testable units on their own — but `kata verify` rejected both
with `kata/schema-file-naming`, since the rule only allows exactly
`<domain>.{route,service,schema,test}.ts` or `<domain>.hurl` directly under
a module folder; there is no allowlisted suffix for "constants" or
"locales", and no subfolder escape hatch either (I checked the rule's
source: it matches `^src/modules/([^/]+)/([^/]+)$`, so a file one level
deeper wouldn't even be scanned — but going that route felt like gaming the
regex rather than following ADR-0018's actual intent).

I resolved it by folding both files' content directly into
`notifications.service.ts` (kept the drift-check and locale-table tests as
separate `*.test.ts` files, since `.test.ts` is excluded from the rule
entirely per the fs-walker). Net effect: a much longer service file than
the plan anticipated, and the fix cost a full replan-and-rewrite of T1/T2
mid-implementation, including a manual-transcription bug in the base64
constant I introduced while re-pasting it (caught by the drift test itself
— which is exactly what it's for).

## Why it matters

This wasn't a mistake in the plan I could have caught in planning-tasks — a
planning session probably doesn't run `kata verify` against files that
don't exist yet. Nothing before hitting `pnpm verify` mid-implementation
signaled that "notifications.locales.ts" would be illegal. If this
constraint (exactly 4 suffixes, no exceptions, no subfolders) were surfaced
by kata-docs MCP or documented somewhere a planning session would think to
check ("what files can a domain module contain?"), the plan could have
specified "fold into notifications.service.ts" from the start.

## Metrics

Zero kata-docs MCP lookups this session — the tool wasn't available (no
matching entry in ToolSearch), consistent with prior sessions' "MCP
absent" reports. I found the actual constraint by grepping kata's own
source at `~/Projetos/kata/packages/verify/src/rules/schema-file-naming.ts`
after `kata verify`'s error pointed at ADR-0018; that lookup + the fix
(rewriting two files' content into a third, patching two test imports, and
redoing the base64 constant via a small node script instead of manual
paste) cost roughly 15-20 extra turns in a ~2.5 hour implementation
session. `kata verify` itself was fast and the error message + ADR
reference were clear enough to self-serve without any doc lookup at all —
the friction was discovering the constraint late, not understanding it
once found.

## Suggested fix

Consider whether `kata verify --strict-coverage` (or a lighter dry-run) is
worth invoking during `planning-tasks` for any plan that names new files
under `src/modules/`, so an illegal filename is caught before
implementation starts rather than mid-implementation.
