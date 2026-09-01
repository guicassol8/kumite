# First `input.query` route in kumite: smooth, plus a hurl `count` trap on an empty match

**Found while**: implementing-tasks for #11 (participant problem read, `GET /problems/:id?locale=`)
**Where in kata**: `reference/define-route.md` § `input`, `guide/routes-schemas.md`
§ query filters; hurl assertions (`pnpm hurl`)

## What

Three observations, none of them a kata bug.

1. **`input.query` worked exactly as documented, first try.** This is the
   first route in kumite to declare a `query` schema. `LocaleSchema.default('pt')`
   gives an optional query param with a default, `c.input.query.locale` is
   typed as the enum (not `string | undefined`), and an unsupported value is
   rejected before the handler with `422 validation_failed` whose
   `issues.query[0].message` already reads
   `Invalid enum value. Expected 'pt' | 'es' | 'en', received 'de'`. That
   message is good enough to be the acceptance criterion itself — the issue's
   "SHALL respond 400 indicating the valid locales" was rewritten to assert the
   422 envelope and its `issues.query`, and nothing custom had to be written to
   produce the list of valid locales. (Complements
   `errors-vs-issue-status-mismatch.md`, which flagged the 400-vs-422 trap at
   planning time — this is the same trap seen from the implementation side, and
   the envelope's content is what made the rewrite painless.)

2. **Nothing between a malformed path param and Postgres but your own schema.**
   Kata does not shape-check `:id` on its own, which is correct and expected —
   but it means `z.string()` for a uuid column is a latent 500: the value sails
   through input validation and dies in the driver. Same repo, same module, two
   routes: the new one uses `z.string().uuid()` and answers 422, while the
   older organizer routes answer
   `500 {"error":"internal_error"}` for `GET /organizer/problems/nao-e-uuid`
   (verified against a live server). Filed as kumite issue #94; recorded here
   only because a "path param that reaches the db" note in
   `guide/routes-schemas.md` would make the failure mode visible before the
   first 500 shows up in a log.

3. **Hurl friction: `count == 0` cannot express "this field appears nowhere".**
   The natural assertion for "no hidden test case leaked" is
   `jsonpath "$..hidden" count == 0`, and it fails — not as a failed assertion
   but as `Filter error: missing value to apply filter`, because a jsonpath that
   matches nothing yields no value for `count` to consume. Same for a filter
   query like `jsonpath "$.examples[?(@.expected==4)]" count == 0`. The working
   spelling is `not exists`. Costed a full hurl round trip (server boot + suite
   run) to discover, and "assert this field is absent from the entire payload"
   is exactly the shape a non-leakage test wants, so it is likely to bite
   anyone writing a security-flavoured hurl assertion.

## Why it matters

(1) is the good news: the docs answered the design question in one round trip
and the framework's default envelope was better than what the issue originally
specified. (2) and (3) are both "the failure mode is invisible until you hit
it" — one costs a 500 in production, the other costs a hurl cycle.

## Metrics

- kata-docs usage this session: 1 `search_docs` + 2 `read_doc`
  (`reference/define-route.md` § `input`, `guide/routes-schemas.md` § the
  `z.coerce.boolean()` trap). ~2.5k tokens total, against a task that ran to
  roughly 130k — under 2% of the session.
- Paid off: yes, but modestly. It confirmed the `query` + `default()` design
  and typing before any code was written (0 rework), and the `z.coerce.boolean()`
  warning is a trap this task would have walked into had the param been a
  boolean instead of an enum. Guessing would probably have produced working
  code here; the lookup bought certainty cheaply.
- `kata verify --strict-coverage`: clean on every run (38 files, ~0.6s), and it
  resolved the `requireUser` middleware chain on the new route with no
  strict-coverage complaint. Zero friction, zero false positives.
- Hook ladder: 4 pre-commit runs at ~45s each, dominated by the front's vitest
  suite (~34s of the 45s), for a back-only change. Not kata's doing — noted
  because it is the recurring cost of the loop, already flagged in
  `verify-clean-on-front-task-but-hook-ladder-eats-e2e-fixtures.md`.
- Extra turns spent on the hurl `count` trap: 2 (one failed suite run plus the
  fix), on top of the db reset covered in
  `hurl-and-unit-tests-fight-over-one-database.md`.

## Suggested fix (optional)

- For (3): a line in whatever hurl guidance kata ships — "to assert a field is
  absent, use `not exists`; `count == 0` errors on an empty match" — would have
  saved the round trip.
- For (2): a sentence in `guide/routes-schemas.md`'s `params` section noting
  that params reaching a typed db column want the matching zod refinement
  (`.uuid()`, `.int()`), since kata deliberately does not infer it.
