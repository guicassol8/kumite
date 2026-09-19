# The 422 envelope's `message` is unusable in a localized app, so `code` is the real contract — and neither is typed

**Found while**: kumite #187 — "Erro genérico Tente novamente mascara o 422 de
validação por campo do organizador" (implementation phase; the planning phase
logged its own line in `LEDGER.csv`).
**Where in kata**: `@katajs-framework/core@0.4.2` — the automatic input-validation
middleware and its `ErrorBody`/`FieldIssue` envelope; `hc<AppType>` typing.

## What

Three observations, all confirmed against a running kata 0.4.2 rather than read
off the docs. The first is the one I had not seen written down anywhere.

### 1. `issues[].message` cannot be shown to a user, so `code` carries the contract

kata's 422 envelope is

```ts
type FieldIssue = { path: string; message: string; code: string; expected?: unknown; received?: unknown }
type FieldIssues = Record<string, FieldIssue[]>   // keyed by section: params/query/body/headers
type ErrorBody   = { error: string; message: string; issues?: FieldIssues }
```

`message` is zod's own text, in English, and kata does not localize it. kumite
ships in pt/es/en and has a test that fails the build when a user-visible string
is missing from any of the three catalogs, so `issue.message` is structurally
unusable as a user-facing message — the only honest thing a consumer can do is
throw it away and pick its own string.

Which means the field a consumer actually depends on is **`code`**. #187 keys on
`code === 'too_big'` to decide between "the score may go up to 10000" and a
generic "the server rejected this value". `code` is therefore load-bearing
contract, not diagnostics — but it is passed through from zod unchanged, so its
value set is zod's, it is undocumented on kata's side, and a zod major (v3 → v4
renames several issue codes) would silently change it. Nothing in kata's types
marks it as stable or as an enum.

This is not theoretical: kumite already had a test fixturing
`{ path: 'maxTeamSize', message: 'Máximo permitido é 50.', code: 'too_big' }` —
a Portuguese `message` kata has never emitted. It passed for months because the
screen rendered `issue.message` verbatim, which means the app was one real 422
away from showing zod's English to a Spanish-speaking organizer. Fixing #187
turned that into a localized string and corrected the fixture.

### 2. `path` really is dot/bracket notation, now pinned by a test

`pathToDotNotation` flattens nested paths to a **string**: `translations[0].title`,
`testCases[0].hidden`, and `''` for a section root. Confirmed live, not inferred:
a PATCH with `testCases: [{ input: 1, expected: 1, hidden: 'nope' }]` answers 422
with `issues.body[0].path === 'testCases[0].hidden'`, and the same shape asserts
cleanly from hurl with `jsonpath "$.issues.body[0].path"`.

kumite now locks this in `back/src/request-limits.test.ts`, because a kata
upgrade that switched to an array — or to `testCases.0.hidden` — would stop every
per-field message on the problem form matching, in silence and with no test
anywhere else that would notice.

Two adjacent behaviours a consumer has to know and that cost a branch each:
`issues` is keyed by **section**, so reading `issues.body` blindly as "the
issues" would swallow the `issues.params` that kumite's GETs turn into a
"not found" screen; and a malformed request body is a **400**, not a 422, with a
single issue whose `path` is `''` and which therefore belongs to no field.

### 3. The status that carries all of this is still not in the type

Known and already filed (`v1/undeclared-status-client-typing-gap.md`), reported
again only because #187 is the task where it stopped being cosmetic. The 422 is
produced by framework middleware and appears in no route's `output` map, so
`hc<AppType>` narrows the error branch to `never` and `res.status === 422` is a
TS2367. Every call site that wants the envelope has to cast through `unknown`.

Before #187 kumite had **three** hand-rolled copies of that cast (a local
`readErrorBody` in `organizer.event-config.tsx`, one in `signup.tsx`, and the
`(res.status as number) === 422` pairs in the problem queries). #187 consolidated
the body-reading ones into a single `front/src/lib/api-issues.ts`, which is the
right shape for kumite but is a workaround for a framework-level typing gap, and
each new screen still has to know to reach for it.

## Why it matters

A consumer that wants per-field error messages — which is the obvious reason the
envelope exists — has to, in order: cast past `hc` because the status is not in
the type; know that `issues` is section-keyed; know that `path` is a string in a
specific notation; know that a malformed body is a different status with a
root-pathed issue; and then discard `message` and re-derive the wording from
`code`. Five pieces of knowledge, none of them in the type, to use the
framework's headline validation feature as intended.

The cost of getting it wrong is quiet. kumite's version of "wrong" was a screen
that told the organizer "Tente novamente" for eighteen months of a value the API
would never accept, plus a green test asserting a message the framework cannot
produce.

## Metrics

- **kata-docs lookups this phase: 0.** The planning phase spent 4 (bundled
  `.d.ts`, `dist/index.js`, `dist/chunk-HSVXNAA5.js`, the docs-mcp
  `guide/errors.md`) and fixed the contract; implementation only had to confirm
  it empirically, which cost nothing extra because the confirmations are the
  deliverable (a test and two hurl cases). The planning lookups paid for
  themselves twice over: reading `issues.body` only, and tolerating the 400's
  empty path, both came straight from them and neither was guessable.
- **`kata verify --strict-coverage` runs: 6** (1 explicit + 5 pre-commit),
  66 files each, **0 findings**. Pure gate, as usual for a task whose back
  change is two `.max()` calls.
- **Friction turns attributable to kata: 1.** The `hc` cast is the only place the
  framework made me write something I would not otherwise write; it cost one
  round of deciding where to put it so it would not become a fourth copy.
- Everything kata-shaped that this task asserts is asserted **live** — 7 new
  vitest cases through `app.request`, 3 new hurl requests through real HTTP —
  rather than against a mock of what the envelope is believed to be.

## Suggested fix

Roughly in order of value per unit of churn:

1. **Declare `code`'s value set**, or stop making consumers depend on it.
   Either export a union type for the codes kata forwards, or add a stable,
   kata-owned discriminator alongside it. Right now the only machine-readable
   signal in the envelope is an untyped passthrough of a third-party library's
   internal vocabulary.
2. **Say in the docs that `message` is English and diagnostic**, not
   user-facing. A one-line note next to `FieldIssue` would have saved kumite a
   fixture that asserted the impossible.
3. **Put the automatic statuses in the route type.** If `defineRoute` folded
   kata's own 422 (and 400, and 413) into the inferred `output` union, `hc`
   consumers would narrow on `res.status` normally and the cast would disappear
   from every downstream app, not just from kumite's one helper.
4. Optionally, ship the `api-issues.ts` shape — read one section, drop root
   issues, degrade to `[]` on any malformed body — as a small client helper in
   `@katajs-framework/core`. Every consumer of the envelope needs exactly this
   function.
