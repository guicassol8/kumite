# kata-docs MCP failed to connect during planning

**Found while**: planning-tasks for #40 (Criar home pós-login com estado do evento ao vivo)
**Where in kata**: the `kata-docs` MCP server config (`.mcp.json`)

## What

At the start of this session `kata-docs` reported `CONNECT_TIMEOUT: "MCP
server kata-docs connection timed out after 30000ms"` and never came up
during the whole planning session (roughly 20 minutes of work). `clickup`
timed out the same way in the same session, so this may be a local/harness
transient rather than a kata-docs-specific bug — but I have no way to tell
from this side.

## Why it matters

Planning #40 needed to reason about several kata-specific things I'd
normally check against kata-docs first: the `output: {}` escape hatch for
never-closing streams (already documented inline as a code comment in
`back/src/modules/sse/sse.route.ts`, referencing "see kata-feedback/ for the
framework gap this is logged against" — so kata-docs itself may hold more
detail on that gap that I couldn't cross-check), the exact semantics of
`requireUser` short-circuiting output validation (ADR-0011, again only
verified via a code comment, not the ADR text itself), and whether adding a
second `GET` route on a path other module already partially owns
(`/rounds` vs `/organizer/rounds`) has any kata-level gotcha. I fell back
to reading existing back/ source and the inline ADR-reference comments
instead, which was sufficient here because the codebase's own comments
were unusually thorough — but that won't always be true, and I couldn't
verify anything against the framework's own docs/ADRs this session.

## Metrics

Zero kata-docs queries made (couldn't connect, so no round-trip cost to
report). Time cost of the workaround: a few extra minutes reading
`back/AGENTS.md` and existing module source directly instead of querying
kata-docs, plus one extra Read of kata's own back/AGENTS.md file that a
working kata-docs query might have answered faster and with more
authoritative detail (e.g. the actual ADR-0011 text vs. a paraphrasing
code comment). Net effect: planning wasn't blocked, but confidence on the
kata-specific edges (output validation short-circuit behavior, the raw
SSE escape hatch) is second-hand (code comments), not first-hand (docs/ADR
text).

## Suggested fix (optional)

None from this session — no visibility into why the connection timed out.
If this recurs across sessions, worth checking whether `kata-docs` has a
slow cold-start that a longer client-side timeout would absorb, versus a
real server-side hang.

## Recurrence: planning #48, different symptom

**Found while**: planning-tasks for #48 (Criar API de config do evento)

This time `kata-docs` wasn't even listed as an available deferred tool —
`ToolSearch` with several queries ("kata-docs", "kata docs search query
framework") returned either nothing or unrelated built-in tools, so unlike
#40's case there was no connect-timeout error to see, just silent absence.
Same underlying effect (no kata-docs access this session) via a different
failure mode, which weakens the "maybe it's a one-off transient" read from
#40 — two sessions, two different symptoms, same net result.

This time the substitute worked better: `~/Projetos/kata` is a full local
checkout, so I read `packages/kata/src/errors.ts` and `context.ts` directly
to confirm the exact automatic-validation error shape
(`400 { error: 'validation_failed', issues }`, ADR-0008/0011) and
`packages/verify/src/rules/index.ts` for the live rule list — both First-
party source, not a paraphrase, arguably more authoritative than a docs
query would have been. Cost: ~4 targeted greps/reads, comparable to what a
couple of kata-docs queries would have cost, with the advantage of reading
the actual implementation rather than documentation-about-the-implementation.
For an agent without a local kata checkout available, this fallback
wouldn't exist and the #40 situation (falling back to kumite-side code
comments only) would repeat.

**Suggested fix (still open)**: if kata-docs' absence/timeout is
reproducible rather than transient, the docs-mcp package itself may be
worth checking (slow `npx -y` fetch on first run each session? See
`.mcp.json`'s `command: "npx", args: ["-y", "@katajs-framework/docs-mcp"]`
— an `npx -y` cold-pull every session start is a plausible source of both
symptoms, timeout vs. simply not-ready-in-time-to-register).

## Recurrence: planning #49, third time, same absence

**Found while**: planning-tasks for #49 (Criar tela de config do evento no
Painel)

`ToolSearch` for `kata-docs` / `mcp__kata` again returned nothing — third
session in a row with no access, same silent-absence mode as #48's
recurrence, not #40's connect-timeout. At this point "transient" reads as
unlikely; it looks like this MCP server just isn't coming up in this
harness/environment at all.

This time there was no framework-level question to answer (the task is
front-only: a settings screen consuming an already-shipped `/organizer/
event-config` and `/organizer/event-codes` API), except one: what shape
kata's automatic validation-error envelope takes, to plan the field-error
mapping in the plan's edit-dialog step. That answer was already sitting in
this very file from the #48 recurrence (`400 { error: 'validation_failed',
issues }`, ADR-0008/0011) — zero new lookups, zero local-checkout reads
needed. Net cost this session: one `grep`-equivalent (re-reading this
file), effectively free. This is a point in favor of kata-feedback as a
durable cache: a first-party-sourced answer logged once during a
connectivity gap paid for itself again two tasks later, cheaper than a
kata-docs round-trip would have been even if the server had been up.

## Recurrence: planning #54, fourth session, same silent absence

**Found while**: planning-tasks for #54 (Criar overview do evento: números-chave
e rodada ao vivo)

`ToolSearch` for `kata docs framework route definition` returned only
unrelated built-in tools (SendMessage, WebFetch, WebSearch, ClickUp,
Figma) — no `mcp__kata-docs__*` anywhere. Same silent-absence mode as the
#48 and #49 recurrences; the only MCP server the harness reported as
"still connecting" this session was ClickUp. Four sessions, zero
successful kata-docs contacts: the connect-timeout framing from #40 is
now clearly the wrong model — this server simply does not register in
this harness.

What's notable is that this session had **no kata question at all** to
ask. #54 adds one `stats` module — a plain `GET /organizer/stats` with
`use: [requireUser, requireOrganizer]`, `input: {}`, `output: Schema` —
and every shape needed was answerable from kumite's own source in one
read: `back/src/modules/event-config/event-config.route.ts` is a
line-for-line template for the route, `app.ts` shows module
registration, and the ADR-0011 "middleware short-circuits skip output
validation" rule is restated as a comment at the top of four different
`.route.ts` files. The only framework-adjacent decision (whether a new
module may import a service from another module) was settled by
precedent — `sse.service.ts` already imports from `rounds.service.ts`
and `ranking.service.ts` — and by this folder's own
`cross-module-service-import-and-optional-secrets-clean.md`.

## Metrics

Zero kata-docs queries (unavailable). Zero local `~/Projetos/kata` reads
needed either — unlike the #48 recurrence, this planning session never
reached a question the kumite codebase couldn't answer first-hand.
Roughly 12 Bash reads/greps total for the whole plan, all kumite-side,
of which **zero** would have been replaced by a kata-docs round-trip.
Honest read for this task: kata-docs' absence cost nothing measurable,
because a well-commented consumer codebase is a better answer than
framework docs for "how do I write the same kind of route again". The
cost profile from #40 (framework docs genuinely needed, second-hand
answers only) reappears only on tasks that touch a kata surface the
codebase hasn't already exercised — this one didn't.

**Suggested fix (still open, unchanged)**: worth checking whether
`npx -y @katajs-framework/docs-mcp` in `.mcp.json` resolves at all in
this environment. Four sessions with two distinct symptoms and no
success suggests the package fetch/spawn itself, not a timeout tunable.
A secondary observation: if kata-docs stays unavailable, the practical
mitigation is already working — the inline ADR-referencing comments in
`back/src/modules/*/*.route.ts` are doing the job docs would, and are
worth treating as a deliberate convention rather than incidental.
