# Planning #145: kata-docs MCP absent again — and the two kata questions were answered by this folder, not by kata

**Found while**: planning-tasks for #145 (reportar bug pelo app: rota pública
`POST /bug-reports` + envio por SES)
**Where in kata**: `@katajs-framework/docs-mcp` (the `.mcp.json` server),
`@katajs-framework/core` 0.4.2 — `c.error` / `c.json` (no headers argument)

## What

Two things worth recording, one procedural and one about the framework surface.

**1. The `kata-docs` MCP server was not connected in this session.** `.mcp.json`
declares it (`npx -y @katajs-framework/docs-mcp`), but no `kata-docs` tool was
exposed to the agent at all — a `ToolSearch` for it returned nothing, so this
wasn't a slow/timing-out query, it was an absent server. This matches the
running pattern already recorded in
`kata-docs-mcp-connect-timeout-during-planning.md`,
`task-98-planning-docs-mcp-down-third-time-source-repo-as-fallback.md` and
`task-143-planning-docs-mcp-down-again-guard-answered-by-dts.md`. Whatever the
root cause, the practical state is that a kumite planning session cannot count
on kata-docs being there, and the skills' instruction to "query kata-docs before
guessing any kata API" has now been unsatisfiable more often than satisfiable.

**2. Both kata questions this plan raised were answered from `kata-feedback/`
itself, not from kata.** The plan needed to know (a) whether a 429 can carry a
`Retry-After` header from a kata handler, and (b) whether an undeclared 422 from
kata's own input validation is fine to leave out of `output`. Answer (a) is *no*
— `c.error` has no header slot and `c.json(value, status)` takes no third
argument — which is written down in
`c-json-has-no-headers-either-and-verify-lets-adhoc-errors-through.md`, an entry
from implementing #21. Answer (b) came from reading `submissions.route.ts`'s own
comment about 413/401 short-circuiting from middleware (framework ADR-0011).
So this folder is now, in practice, kumite's kata reference — which is fine as a
stopgap and bad as a steady state: it only ever accumulates the parts of kata
that kumite has already been burned by, it is not versioned against kata
releases, and a newcomer agent has no way to know which entries are still true.

The `Retry-After` gap shaped the plan directly: rather than hand-building a
`Response` (the escape hatch #21 used once), #145 will answer 429 with the plain
kata error envelope and let the front show a fixed translated "wait a moment"
message. That's the second time a kumite route has had to design *around* the
absence of a response-header slot, in a codebase with exactly two throttled
routes.

## Why it matters

The docs-MCP absence is cheap per session but corrosive: each planning session
either re-derives framework facts from `.d.ts`/source, or trusts a local
feedback note that nobody has re-validated against the installed version. Both
are silent-failure modes — a stale note reads exactly like a fresh one.

The headers gap matters because rate limiting is the canonical case for a
response header (`Retry-After`), and kata already ships the adjacent hardening
middlewares (`bodyLimit`, `secureHeaders`). A consumer hitting 429 has three
options today: skip the header, break the error envelope with a raw `Response`,
or add a Hono-level middleware that patches headers after the fact. #21 chose
the second, #145 is choosing the first — two routes in one app answering the
same question differently, purely because the framework has no opinion.

## Metrics

Zero kata-docs queries made — the server was absent, so there was nothing to
query and no round-trip cost either way. The two kata questions cost ~1 turn
total, both answered by `grep` over `kata-feedback/` and `back/src/modules`
(~3k tokens) against a planning session of ~15 tool calls. Cheap *this* time
precisely because a previous session had already paid to discover the `c.json`
signature the hard way (a TS2554 during #21's implementation) and wrote it
down. That's the whole point of the entry: the lookup was cheap because the
answer was local, not because the framework surface was discoverable.

## Suggested fix (optional)

1. Whatever is wrong with `@katajs-framework/docs-mcp`'s startup (npx resolution,
   publish state, stdio handshake) is now the single highest-value kata fix for
   kumite — five-plus sessions of a declared MCP server never appearing.
2. An optional `headers` field in `ErrorExtra` (and a third argument on
   `c.json`, matching Hono's own signature) would close the `Retry-After` gap
   without any new middleware. It's additive and doesn't touch ADR-0008's
   error-shape guarantee — the envelope stays identical, only the transport
   metadata gains a slot.
