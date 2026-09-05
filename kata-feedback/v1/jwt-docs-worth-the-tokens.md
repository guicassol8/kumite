# kata-docs paid for itself planning the JWT/login feature

**Found while**: planning #26 (login issuing a JWT + `GET /me`)
**Where in kata**: `kata-docs` MCP — `guide/jwt.md`, `cookbook/auth.md`;
`@katajs-framework/core/jwt` (`signJwt`, `jwtAuth`, `resolve`, `requireRole`/`guard`)

## What

Not a bug — a positive/neutral observation, logged per the broadened
kata-feedback scope. Planning #26 needed the full JWT surface: how to mint
a token with custom claims (`sub`/`role`/`university`), how `jwtAuth` +
`resolve` fill a scoped slot, and how the auth-failure envelope is shaped.
Two `search_docs` calls plus two full `read_doc` reads (`guide/jwt.md`,
`cookbook/auth.md`) answered every one of those questions directly, with no
need to fall back to guessing from `back/`'s existing code or from kata's
source.

One specific payoff: the docs carry an explicit "endorsed layout" callout —
if the app has no dedicated `users` domain, colocate `UserClaimsSchema` in
`auth.schema.ts`; if it does (kumite does), it belongs in `users.schema.ts`
and the `/me` route belongs in a `users` module. That single documented tip
directly decided a real plan question (where the claims schema and `/me`
route live) that source-reading alone would have left as a guess or an
extra question to the user.

## Why it matters

For anyone deciding whether wiring `kata-docs` into the planning workflow
is worth the token overhead: for a framework surface this size (JWT sign /
verify / auth middleware / guards), yes — it replaced what would likely
have been several guess-and-check round trips against kata's source, and it
surfaced a documented convention (the layout tip) that isn't discoverable
from source alone.

## Metrics

- 2 `search_docs` calls, 2 `read_doc` calls (`guide/jwt.md` and
  `cookbook/auth.md` read in full — no `heading` filter, since at that point
  I didn't yet know which subsections I'd need).
- The two full-page reads were the single largest tool-output chunk of the
  planning session — noticeably more tokens than any other lookup that
  turn — but they resolved four separate plan-affecting questions in one
  pass: claims-schema placement, the `resolve()` → 401 "no such user"
  contract, the exact 401 reason-code table (used verbatim in the plan's
  error handling), and the `requireRole`/`guard` shapes needed by the
  sibling issue (#27), which I did not have to re-look-up when scoping this
  plan's boundary against it.
- Net effect: zero guessed API shapes in the posted plan, and one design
  decision (module placement) traced directly to a documented convention
  rather than an inference — which is exactly the kind of thing house rule
  #1 would otherwise have turned into a question to the user.

## Suggested fix (optional)

None. Usage note for future agents rather than a kata change: reading full
pages (not passing `heading`) was the right call here specifically because
the exploration was "what does this whole surface look like," not "what
does this one function do" — `read_doc`'s `heading` filter is there for the
narrower case and would've meant more round trips if used prematurely.

---

## Confirmed during #27's implementation (the sibling issue this plan scoped against)

The #26 plan above says it didn't need to re-look-up `requireRole`/`guard`
when scoping #27's boundary — this is that payoff landing for real, one
session later with no shared memory of the planning session.

Implementing #27 (`requireOrganizer` guard on the 6 organizer routes) did
one fresh `search_docs("requireRole guard middleware")` plus one full
`read_doc("guide/jwt.md")` — the same page the #26 planning session read —
to confirm the exact generic signature
(`requireRole<R, S>(role, options?)`, `R` explicit, `S` inferred) and the
403 envelope shape (`{ error: 'forbidden', message: 'Insufficient
permissions' }`) before writing any code. Both matched the approved plan's
text verbatim; `requireOrganizer = defineMiddleware({ provides: [] as
const, handler: requireRole<AppRegistry>('organizer') })` compiled and
passed `pnpm verify` on the first attempt, no guessing, no `tsc` round-trip
to fix a wrong type argument.

**Metrics**: 1 `search_docs` + 1 `read_doc` call for the whole guard
surface, against ~14 tool calls for the rest of the implementation
(reading existing routes/schemas, writing the test suite, running gates).
That single doc read is what let a guard with a slightly unusual generic
shape (`R` explicit, no second type argument) go in correct on the first
try — the warning box in the doc about the old `guard<R, C>` breaking
change would have been very easy to trip over by pattern-matching on
`requireUser`'s call site alone.
