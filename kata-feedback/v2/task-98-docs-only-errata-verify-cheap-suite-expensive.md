# The module lock is strict enough to need an ADR errata — and the docs-only gate ladder is 99% test suite

**Found while**: #98 (implementing) — registering an errata in
`back/docs/adr/0001-judge-sandbox-engine.md` about where the judge worker lives.
**Where in kata**: `kata verify` (`kata/schema-file-naming`),
`docs/guide/project-layout.md`.

## What

Two observations, no bug.

1. **The rule is fine; the prose around it wasn't.** `kata/schema-file-naming`
   locks `src/modules/<domain>/` to five suffixes (`.route.ts`, `.service.ts`,
   `.schema.ts`, `.test.ts`, `.hurl`) while the `src/` root is open. That rule
   is correct and well documented — but kumite's own ADR-0001 said "#19 ports
   this logic into `src/modules/judge/`" about a `sandbox-engine.worker.ts`,
   which read literally is a layout `kata verify` would reject. This whole
   issue exists to annotate that. The signal for kata: the lock is strict
   enough that *consumer* documentation drifts into describing impossible
   layouts, and the only thing that catches it is running `kata verify` (or
   reading `guide/project-layout.md`). It caught nothing here because nobody
   ever wrote the bad layout — the misreading lived in prose for ~2 weeks.
2. **Rule ID namespacing is easy to drop.** An earlier kumite feedback entry
   cited the rule as `schema-file-naming`; the actual ID is
   `kata/schema-file-naming`. Worth knowing that the un-namespaced form is the
   one humans/agents remember.

## Why it matters

For kata: nothing to fix. For any kata consumer: the module lock is a
layout-shaped constraint, so any doc that says "this code goes in module X"
is implicitly making a claim `kata verify` can falsify — and a plain-prose
claim never gets verified. A docs example in `guide/project-layout.md`
spelling out "helper/worker/script files that don't match the five suffixes
live at the `src/` root, and referencing them from the module is normal"
would have prevented the misreading at the source.

## Metrics

- **kata-docs MCP lookups this session: zero.** None were needed —
  `planning-tasks` had already read the rule straight from
  `~/Projetos/kata/docs/guide/project-layout.md` (the MCP server failed to
  start in that session, the third such failure recorded in this folder).
  Implementation cost nothing in kata round-trips: 0 turns, 0 tokens.
- **Gate ladder on a docs-only change** (`pnpm check`, one file, 27 added
  lines of Markdown): **128.9s total** — `typecheck` 19.5s, `kata-verify`
  **1.35s** (61 files), `test` 108.1s (989 tests across three packages). Then
  the pre-commit hook ran the identical ladder a second time, so the real
  cost of committing one Markdown paragraph was ~4.3 minutes of gates.
  `kata verify` is emphatically *not* the tax here — it is ~1% of the ladder
  and the cheapest signal in it. Recording the number so a future reader
  doesn't blame the framework for the wait.
- **Friction from kata: none.** `kata verify --strict-coverage` was green,
  first try, unchanged by this task — which is the expected result for a
  change that only edits `back/docs/`.

## Suggested fix (optional)

Optional and small: in `guide/project-layout.md`, next to "Module directories
stay locked", add one worked example of the legal escape hatch (a worker or
script at the `src/` root, imported by `<domain>.service.ts`). The rule
already allows it; making it explicit is what stops downstream docs from
describing the illegal version.
