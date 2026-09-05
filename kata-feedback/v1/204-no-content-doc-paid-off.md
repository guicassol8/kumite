# 204-response doc paid for itself, once

**Found while**: #31 (teams API — `POST /teams/leave` returns 204)
**Where in kata**: `guide/routes-schemas.md` § "204 No Content"

## What

Before writing the leave route I guessed `c.body(null, 204)` for the
no-body success case, since kata has no `c.body`-style helper visible from
the route handlers I'd already read (`problems.route.ts`, `auth.route.ts`,
`users.route.ts` — none of them return 204). A `kata-docs` search for "204
no content response" landed directly on the right doc section, which
specifies the real (non-obvious) API: `output: { 204: NoContentSchema }`
with `z.void()`, and the handler returns `c.json(undefined, 204)` — not
`c.body`. The doc also explains *why* `c.json(undefined, 204)` works and a
literal `''`/`null` body would throw at request time (Fetch `Response`
forbids a body on 204), which isn't discoverable by pattern-matching
existing routes since this codebase had zero prior 204 responses to copy.

## Why it matters

A guessed `c.body(null, 204)` would have failed at runtime (no such method,
or a body-on-204 throw depending on kata's actual surface) and only been
caught by the hurl run — a slower, noisier failure mode than a one-shot doc
lookup.

## Metrics

One `search_docs` call + one `read_doc` call with a `heading` filter (so
only the relevant section, not the whole guide, entered context) — roughly
400 input tokens for the doc content, against a task whose total context
was in the tens of thousands. Fully paid for itself: it replaced a guess
that would have needed a live-server round-trip (start `pnpm start`, hit
the route, read the error) to disprove.
