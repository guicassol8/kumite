# kata-docs MCP down again during planning — the bundled .d.ts answered the question instead

**Found while**: planning-tasks for #143 (Reset de senha via organizador com step-up e senha temporária)
**Where in kata**: `kata-docs` MCP server (`.mcp.json`); `@katajs-framework/core@0.4.2` — `dist/jwt/index.d.ts`, `dist/context-*.d.ts`

## What

Two things, one session.

**1. `kata-docs` was unavailable again.** No `kata-docs` tool ever showed up
in this session's tool surface — a `ToolSearch` for it returned "No matching
deferred tools found". Same practical outcome as
`kata-docs-mcp-connect-timeout-during-planning.md` (planning #40), which
makes this the second planning session in a row where the MCP server
contributed nothing. Unlike that session, no timeout error was surfaced to
me either; the server simply wasn't there, so there was no signal to act on
beyond noticing the absence.

**2. The bundled `.d.ts` turned out to be an excellent substitute — for this
particular question.** The plan hinged on one kata question: can a route-level
middleware short-circuit with a *custom* 403 code, and is there a sanctioned
way to do it that `kata verify` can still resolve? Reading
`back/node_modules/@katajs-framework/core/dist/jwt/index.d.ts` answered it
completely and quickly: `guard({ slot, authorize, code, message })` is exactly
the primitive, the doc comment spells out that it provides nothing and must be
wired `provides: [] as const` *after* the auth middleware, and it explains why
`resolve` returning null is a 401 while `guard` is the 403 path (ADR-0013 §5).
The `Route<R, M, P, I, O>` type in `dist/context-*.d.ts` likewise settled that
`route.use` / `route.path` / `route.method` are readable at runtime, which is
what made a guard-rail test (assert every authenticated route carries the new
middleware) plannable at all.

Worth naming: these are unusually good doc comments. They carry the *rationale*
and the ADR cross-references, not just the signature. For an agent, a
well-commented `.d.ts` that ships with the package is strictly more reliable
than an MCP server that may or may not be up — it is already on disk, it is
version-locked to what the app actually imports, and it costs one `cat`.

## Why it matters

The planning question I had was a design fork with real cost attached: the
alternative to `guard()` was hand-composing a middleware that calls `jwtAuth`'s
handler internally, which `back/AGENTS.md` warns is the shape
`kata verify --strict-coverage` flags as an unresolvable chain. Getting that
wrong would have surfaced as a blocked commit hook mid-implementation, in a
different chat, with the plan already approved. The `.d.ts` de-risked it in
about two minutes.

The flip side is that this only worked because the answer happened to live in a
type declaration. Anything that is *not* expressible in a signature or a doc
comment — `kata verify`'s own rule set, hurl behaviours, ADR text in full — has
no on-disk fallback in the consumer's `node_modules`, and for those I'd have
been stuck guessing again.

## Metrics

- kata-docs queries: **0** (server unavailable). Round-trip cost: 0 tokens.
- Fallback cost: 4 Bash calls to locate and read kata's `.d.ts` files
  (`find` for the package path, then three `cat`/`grep -A` reads), roughly
  8k tokens of a ~90k-token planning session — call it **9%**.
- Did the fallback pay off: **yes, decisively**. It flipped the plan's
  middleware approach from a hand-composed wrapper to `guard()`, and it
  unlocked the runtime-introspection guard-rail test. Guessing would have
  produced a plan that plausibly fails the pre-commit gate.
- Turn friction: none attributable to kata. No `kata verify` was run this
  session (planning writes no code).

## Suggested fix (optional)

Nothing to fix in the framework's code. Two observations for whoever triages:

1. Whatever is wrong with `kata-docs` MCP startup has now cost two planning
   sessions. A hard failure with a visible error would at least be actionable;
   silent absence is worse than a timeout, because there is nothing to report
   upstream and no prompt to retry.
2. Since the shipped `.d.ts` is carrying this much weight for consumers,
   it is worth treating as a first-class doc surface — e.g. making sure
   `kata verify`'s rules and the strict-coverage failure modes get the same
   doc-comment treatment the JWT/guard surface already has. That's the gap
   the `.d.ts` could *not* cover this session.
