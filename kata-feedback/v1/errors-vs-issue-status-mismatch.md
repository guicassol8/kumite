# Automatic-validation status (422) is easy to assume is 400 when writing acceptance criteria

**Found while**: planning-tasks for #10 (organizer problems CRUD)
**Where in kata**: `guide/errors.md` (input validation stage), `c.error` default status

## What

Not a kata bug — a documentation-clarity observation. Kata's automatic
input-schema validation always answers `422 validation_failed`, while a
handler's own domain errors via `c.error(...)` default to `400`. Both are
"the payload was wrong" from a product-writer's point of view, and it's easy
to write an acceptance criterion like "WHEN an invalid payload arrives THE
SYSTEM SHALL respond 400 with a structured zod error" without realizing that
`400` is never what the *automatic* zod validation actually returns — only a
status a handler explicitly chose is ever `400`. This repo had already hit
the same trap once (`auth.hurl` step 5 correctly asserts `422` for a short
password, but the sibling issue's acceptance text still says "400 com erro
zod estruturado" for any invalid payload).

## Why it matters

For a kumite planning session, this means every issue mentioning "invalid
payload → 400" needs a manual cross-check against `guide/errors.md` before
being taken literally, or the plan/tests end up asserting a status the
framework will never actually send for schema-level validation. It's a
5-10 minute trap per issue if not caught early (it wasn't caught until this
session cross-referenced `auth.hurl`).

## Metrics

- 2 targeted `search_docs` calls + 3 `read_doc` calls (`guide/errors.md` in
  full, `guide/routes-schemas.md` in full, `cookbook/non-goals.md` one
  heading) during this planning session, on top of `get_toc` once.
- Rough cost: a few thousand tokens total for the docs reads, small next to
  the session's overall context, and it directly resolved a real
  spec/framework mismatch that would otherwise have been silently
  mis-implemented (assuming the acceptance text at face value) or caught
  only much later at hurl-writing time.
- Net: clearly paid for itself — cheaper to catch here than after code +
  wrong hurl assertions were already written.

## Suggested fix (optional)

A short callout box in `guide/errors.md`'s "422 validation envelope" section
— something like "when writing product acceptance criteria, note that
automatic schema validation is always 422; only your own `c.error` calls can
produce 400" — would make this discoverable without needing to already
suspect the mismatch exists.
