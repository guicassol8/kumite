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
