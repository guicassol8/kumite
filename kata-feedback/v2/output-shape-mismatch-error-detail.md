# Output shape mismatch gives no field-level detail

**Found while**: #48 (event-config/event-codes organizer API)
**Where in kata**: route output validation (`defineRoute`'s `output` schema check)

## What

`EventCodeSchema` (pre-existing, `event-codes.schema.ts`) declared
`createdAt`/`updatedAt` as `z.date()` instead of `z.coerce.date()`. This went
unnoticed because `findEventCode` was only ever called internally (by auth) —
nothing round-tripped it through JSON until #48 added the first HTTP routes
that return it. The failure mode was a bare `500
{"error":"internal_output_shape_mismatch","message":"Response did not match
the declared output schema"}` — no field name, no expected/actual, no zod
issue array. Diagnosing it meant noticing the pattern from `TeamSchema`'s own
comment ("coerce, not date(): kata re-validates the output after JSON
serialization...") and checking every `z.date()` field by hand.

## Why it matters

The *input*-side validation error (`validation_failed`) does include the zod
issues array, which made every other schema bug in this task fast to fix.
The output-side one doesn't, even though it's arguably more useful there
(it's a framework/programmer error, not user input, so there's no security
reason to hide the detail from responses in dev/test environments at least).
Any kumite schema with a raw `z.date()` field is a silent landmine until the
first route that returns it goes live — could plausibly be caught by a
lint/verify rule instead of a runtime 500.

## Metrics

Small: one extra `kata verify`/typecheck-test-hurl loop cycle (~1 turn) to
notice the 500, recall the `TeamSchema` comment, and grep every
`z\.date\(\)` occurrence in the touched module to find the two offending
fields. No kata-docs MCP lookup was made for this task — the fix was found by
pattern-matching an existing in-repo comment, which was faster than a doc
round-trip would likely have been.

## Suggested fix (optional)

Include the zod `.issues` (or a redacted subset) in
`internal_output_shape_mismatch`'s body — at least the field path — the same
way `validation_failed` already does for input. Optionally, a `kata verify`
rule flagging schema fields typed `z.date()` (vs `z.coerce.date()`) inside an
`output` schema, since the coercion note already reads like tribal knowledge
that has to be re-discovered per schema.
