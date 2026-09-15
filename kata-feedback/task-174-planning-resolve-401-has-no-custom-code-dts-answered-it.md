# `jwtAuth`'s `resolve` rejection has no custom error code, and that asymmetry with `guard()` decided a product trade-off

**Found while**: planning-tasks for #174 (desativar um usuário não derruba a
sessão dele — P0, o token já emitido continua submetendo e pontuando)
**Where in kata**: `@katajs-framework/core/jwt` — `JwtAuthOptions.resolve`
vs. `GuardOptions.code` / `GuardOptions.message`; `kata-docs` MCP server
(`.mcp.json`)

## What

**1. `kata-docs` was absent a fourth consecutive planning session.** No
`kata-docs` tool in the session's surface; two `ToolSearch` calls ("kata docs
search", "kata framework docs") returned only unrelated tools. Same silent
nothing as `task-98-...`, `task-145-...` and `task-143-...`. The `.mcp.json`
entry is intact and unchanged. Nothing new to add to the escalation those
entries already made — logging it only so the streak stays countable.

**2. The bundled `.d.ts` fully answered the question this time — best case for
that fallback.** The design question was: can the 401 that `jwtAuth` renders
when `resolve` returns `undefined` carry a custom error code, the way
`guard()`'s 403 can? The doc comment on `JwtAuthOptions.resolve` answers it
outright, and better than a signature had to:

> Returning `null` / `undefined` means "authenticated, but no such user" and
> renders a 401 (ADR-0013 §5) — distinct from a 403, which is an
> *authorization* decision the `guard` makes.

Paired with `GuardOptions`, which does expose `code` and `message`, that is a
complete answer with the reasoning attached. Unlike #98's rule-text question,
this one was expressible in a signature plus a doc comment, so the `.d.ts`
fallback landed exactly where it works. Credit where due: the prose in
`dist/jwt/index.d.ts` is unusually good — the `jwtAuth` block enumerates all
three 401 paths and even explains *why* `invalid_token` and `expired` collapse
into one message ("no validity oracle").

**3. The observation worth triaging: the customisation asymmetry is
load-bearing for consumers.** `guard()` takes `code` and `message`;
`resolve`'s rejection takes neither — it is `undefined` or nothing, and the
client always sees the same generic 401 that a malformed or expired token
produces.

For kumite that was not a detail, it was the whole decision. #174 needs a
deactivated account's live session to die. Two shapes were available:

- check `active` inside `resolve` → **fail-closed**: covers all 16
  authenticated routes and every future one, impossible to forget — but the
  401 is indistinguishable from "token expired", so the SPA can only show a
  generic "sessão expirada" and the user is never told they were banned;
- a `guard()` with `code: 'account_deactivated'` → **explainable**, front can
  translate a real message and `GET /me` can be exempted so the client learns
  *why* — but it is per-route and therefore **fails open**: a route added later
  that forgets the middleware is silently unguarded. kumite already pays for
  that failure mode once, with a route-walking guardrail test (ADR-0004).

There was no third option. We picked fail-closed and accepted the mute 401,
because for a moderation lever "cannot be forgotten" beats "can be explained".
That is a defensible outcome, but it was forced by the framework, not chosen
freely — the safe mechanism and the informative one are different mechanisms,
and kata makes you trade one for the other.

## Why it matters

"Authenticated, but this account may not act" is a common third state, distinct
from both "no such user" and from an authorization decision about a *specific*
resource: banned, suspended, locked, tenant disabled, payment lapsed. It is
naturally a `resolve` concern — `resolve` is already the one place that loads
the user row, so the flag is free there and the check cannot be skipped. But
because that path can only produce an anonymous 401, every consumer with a
state like this faces the same fork kumite hit, and the fail-closed answer
costs them the ability to explain themselves to the user.

Worth stating plainly: this is not a bug, and the current design is coherent —
ADR-0013 §5 draws the 401/403 line deliberately and the "no validity oracle"
reasoning behind the collapsed messages is sound. The gap is that the oracle
argument applies to *token* validity, not to account state. Telling a caller
who holds a valid, unexpired, correctly-signed token that their account is
deactivated leaks nothing they don't already know.

## Metrics

- kata-docs queries: **0** (server unavailable). Round-trip cost: 0 tokens.
- Fallback cost: **3 Bash calls** — `ls` the core `dist/`, `grep -l jwtAuth`
  over the `.d.ts` files, then one `grep -n` and one `sed -n '60,155p'` to read
  the `JwtAuthOptions` / `GuardOptions` block. Roughly **2.5k tokens of a
  ~55k-token planning session, ~4%**. Cheapest kata lookup logged so far.
- Did the fallback pay off: **yes, decisively**. It is what ruled out the
  "401 with a custom `account_deactivated` code" shape that the plan would
  otherwise have specified and implementation would have discovered was
  impossible — and it turned the choice into an explicit, documented product
  trade-off put to the user, instead of a surprise mid-implementation.
- Turn friction: none attributable to kata. No `kata verify` run (planning
  writes no code).
- Harness note, not kata's fault: `gh issue view <N> --comments` returned empty
  output with exit 0 three times in this session while `--json` worked fine.
  Recorded here only so the next planner recognises it and reaches for `--json`
  immediately.

## Suggested fix (optional)

Either shape would close it without touching the 401/403 line:

1. Let `resolve` reject with detail instead of only `undefined` — e.g. return
   a sentinel like `{ __reject: { code, message } }`, or accept a thrown
   framework-provided `UnauthorizedError(code, message)`; or
2. Give `jwtAuth` the options `guard` already has for its own rejection —
   `noSuchUserCode` / `noSuchUserMessage`, defaulting to today's values.

(1) is the more expressive: it lets one `resolve` distinguish "no such user"
from "deactivated" from "locked" in a single lookup. (2) is smaller and fully
backward compatible, and would already have been enough for #174.

Not blocking kumite — #174 ships with the fail-closed 401 either way, and the
mute-vs-explainable trade-off is written down in the plan and in a note on
kumite's own ADR-0004.
