# Locked module suffixes caught a plan that would've violated them

**Found while**: planning-tasks for issue #19 (judge sandbox execution
service — porting ADR-0001's characterization engine into a real service)
**Where in kata**: `guide/project-layout.md` (`schema-file-naming` rule),
`adr/0018-file-naming-convention-enforcement.md`

## What

The kumite repo's own ADR-0001 says, in its own words, that issue #19
"ports this engine into `src/modules/judge/`" — referring to
`sandbox-engine.worker.ts`, a `worker_threads` entry-point script that is
not a route/service/schema/test/hurl file. Read literally, that phrasing
would have me move or duplicate the worker script into
`src/modules/judge/`, which `kata verify`'s `schema-file-naming` rule (per
`guide/project-layout.md`'s "Module directories stay locked... nothing
else") would reject on the first run — module folders only ever take the
five locked suffixes, no exceptions, regardless of whether the file is
HTTP-adjacent.

Two `search_docs` queries + two `read_doc` calls
(`guide/project-layout.md`, `adr/0018-file-naming-convention-enforcement.md`)
confirmed the rule text and settled the design: the worker script stays at
`src/` root (same as the existing `sandbox-engine.worker.ts` and
`config.ts`), and only the pool/queue/outcome-mapping logic — genuinely
"service" code — moves into `src/modules/judge/judge.service.ts`. The
final plan reads ADR-0001's sentence as "the *service surface* lives in
`src/modules/judge/`," not "the worker file physically moves there."

## Why it matters

Not a kata bug — the rule is documented clearly and consistently (`guide/
project-layout.md`'s "The `src/` root is open... Module directories stay
locked" section states exactly this asymmetry). The value here is that a
kumite-repo ADR's own prose, if trusted without checking the framework docs,
would have produced a plan that fails `kata verify` on the first
implementation pass. Recording this in case a future planner hits the same
ADR wording and is tempted to skip the doc check because "the ADR already
said where it goes."

## Metrics

2 `search_docs` queries, 2 `read_doc` calls, small relative to the rest of
the planning turn (most of which went into interrogating the user about the
outcome-classification and mid-batch-failure decisions, not into kata
lookups). Clear payoff: cheap insurance that directly prevented a plan
shaped around a rule violation, versus discovering it only when `kata
verify` failed during implementation.
