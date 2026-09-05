# `c.error` domain errors have no structured payload — only a message string

**Found while**: planning kumite #13 (organizer problem form; front consumes
`POST /organizer/problems/:id/publish`)
**Where in kata**: `guide/errors.md` § "Custom statuses: `c.error` and `c.json`",
`ErrorBodySchema` / `ErrorExtra` in `@katajs-framework/core`

## What

`c.error(code, message, extra?)` builds `{ error, message, issues? }`, where
`issues` is typed as `Record<string, FieldIssue[]>` — i.e. **field**-shaped,
meant for input validation. There is no slot for a domain error's structured
data.

kumite's publish route hits this exactly. The handler already knows the answer
as data:

```ts
return { ok: false, error: 'incomplete_translations', missingLocales: ['es', 'en'] }
```

but the only way to get `missingLocales` onto the wire is to interpolate it
into prose:

```ts
c.error('incomplete_translations',
  `Missing translations for locale(s): ${result.missingLocales.join(', ')}`,
  { status: 400 })
```

So the front, which must point at the *tab* for each missing language, can
only recover that list by regexing an English sentence. The doc is clear and
correct about what `c.error` does — this is a capability gap, not a docs gap.

`extra.issues` is a near-miss: it *is* structured and it *is* typed, but its
`FieldIssue` shape (`path`, `message`, …) describes an input field, and
`missingLocales` isn't one. Bending it to fit would encode a domain fact as a
fake validation issue.

## Why it matters

Any consumer that wants to *act* on a domain error — not just display it — is
pushed to string-parse. That couples the client to the server's message copy
(and to its language: kata messages are English, kumite's UI is pt/es/en),
and it breaks silently when someone rewords the message, since nothing type-
checks the sentence. In kumite's case the API is the single source of truth
for publish rules, yet the front ends up re-implementing those rules client-
side purely so it can produce a *localized, targeted* error — the API's own
verdict arrives too unstructured to use. That's rule duplication caused by the
envelope's shape, not by a design preference.

Related but distinct from `errors-vs-issue-status-mismatch.md` (that one is
about status/issue semantics; this is about domain payloads having nowhere to
go).

## Metrics

Cheap and it paid off. Two kata-docs round-trips — one `search_docs`
("ErrorBodySchema c.error response body shape error code") plus one
`read_doc` of a single heading — roughly 1.2k tokens all-in, against ~60k for
the planning session. It settled the question outright: without it I'd have
assumed `c.error` could carry arbitrary extra keys, and the plan would have
told the implementer to read `body.missingLocales`, which doesn't exist. The
`heading` parameter on `read_doc` is what kept the cost down — one section
instead of the whole errors guide.

## Suggested fix (optional)

Allow a domain payload alongside the envelope, e.g. `extra.details?: JsonValue`
surfacing as a `details` key, with `ErrorBodySchema` typing it as optional and
unknown. Consumers that ignore it are unaffected; consumers that need it stop
parsing prose. If that's too broad, a narrower version — letting the route's
`output` map declare a *custom* error schema per status, instead of only
`ErrorBodySchema` — would give the same benefit with full type-checking on
both ends.
