# kata-docs from the consuming (front) side — errors.md + rpc-client.md paid off differently than the back-side JWT read

**Found while**: planning #28 (front signup/login screens + session state + route guards)
**Where in kata**: `kata-docs` MCP — `guide/errors.md`, `guide/rpc-client.md`, `adr/0013-jwt-delivery.md`, `cookbook/auth.md`

## What

Positive/neutral observation, not a bug. Every prior kata-docs lookup logged
in this folder (e.g. `jwt-docs-worth-the-tokens.md`) was from the
**producing** side — building a kata back route/middleware. #28 is the first
kumite plan to consult kata-docs purely as a **consumer** of an already-built
kata API: a React front with a typed `hc<AppType>` client and zero back
changes. The angle was different enough that the same docs answered new
questions:

- `guide/errors.md`'s full envelope table (`ErrorBody`, `FieldIssue`, the
  422 `issues` keyed-by-section shape) let the plan write an exact
  error → i18n-key mapping table up front, instead of guessing the shape of
  `issues.body[].path` from the `.hurl` file alone.
- `guide/rpc-client.md`'s "Multi-status responses narrow on `res.status`"
  and "Extracting the types directly" sections directly shaped two plan
  decisions: (1) branch on `res.status` per declared output map rather than
  a generic try/catch, and (2) derive the front's `User`/`LoginResponse`
  types via `InferResponseType<typeof api.me.$get, 200>` instead of
  importing runtime schemas from `@kumite/back` — which matters here because
  `docs/tech-stack.md` explicitly bans any front↔back runtime coupling
  beyond a type.
- ADR-0013's failure table (`Missing bearer token` / `Invalid or expired
  token` / `No such user`, all collapsed to one 401 `unauthorized` message)
  confirmed a plan decision I'd otherwise have had to ask the user about:
  the front's global-401 interceptor can't distinguish "token expired" from
  "token malformed" from "user deleted" — by design, ADR-0008 Alt. D — so
  the plan correctly treats every authenticated 401 as one "session
  dropped" event rather than trying to show a more specific message.

## Why it matters

Confirms the "docs pay for themselves" finding generalizes past the
back-building case: for a front task that only *consumes* a kata contract,
`errors.md` + `rpc-client.md` were enough to avoid both (a) guessing the
wire shape from `.hurl`/route source, and (b) asking the user a question
that was actually already answered by a documented ADR decision
(ADR-0013's deliberate 401-message collapsing).

## Metrics

- 2 `search_docs` calls, 3 `read_doc` calls (`guide/errors.md` and
  `guide/rpc-client.md` read in full, `adr/0013-jwt-delivery.md` and
  `cookbook/auth.md` read in full via a prior turn's search results).
- This was a planning session, not implementation, so there's no code size
  to compare against — but the lookups directly produced two artifacts that
  went straight into the posted plan: the error-mapping table and the
  `authFetch`/`InferResponseType` design, both written with zero
  placeholders like "TODO: confirm exact shape."
- Counterfactual: without `guide/rpc-client.md`'s "Extracting the types
  directly" section, the front session-store design would likely have
  either (a) guessed at re-declaring a local `User` type by hand (a
  duplication/drift risk flagged nowhere else), or (b) become a question to
  the user about whether importing `@kumite/back`'s schema types at runtime
  is acceptable — which `docs/tech-stack.md` already answers ("only a
  type"), so the question would have been redundant with existing project
  docs. The kata doc closed that gap directly.

## Suggested fix (optional)

None. Note for future agents: when a kumite plan is front-only and only
*consumes* an existing kata route, `guide/rpc-client.md` is worth reading
in full even if the immediate question seems narrow ("how do I read a 401
body") — the "Extracting the types directly" section a few paragraphs later
turned out to be load-bearing for a separate, unrelated plan decision
(avoiding a cross-package runtime import) that wasn't the reason I opened
the doc.
