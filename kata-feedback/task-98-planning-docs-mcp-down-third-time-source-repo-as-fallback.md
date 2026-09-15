# kata-docs MCP down a third consecutive planning session — this time the kata source repo was the fallback

**Found while**: planning-tasks for #98 (registrar errata no ADR-0001 sobre onde
o worker do judge mora)
**Where in kata**: `kata-docs` MCP server (`.mcp.json`);
`~/Projetos/kata/docs/guide/project-layout.md`

## What

**1. `kata-docs` was unavailable again — third planning session in a row.**
No `kata-docs` tool appeared in the session's tool surface; `ToolSearch` for
it returned "No matching deferred tools found". Same silent absence as
`task-143-planning-docs-mcp-down-again-guard-answered-by-dts.md`, and before
that `kata-docs-mcp-connect-timeout-during-planning.md` (#40). Three sessions,
zero contribution, and still no error surfaced — just nothing there.

**2. The fallback this time was kata's own source checkout, not the bundled
`.d.ts`.** #143's session fell back to `node_modules/@katajs-framework/core/
dist/**/*.d.ts`, which worked because the question was about a function
signature. This task's question was not: it needed the *rule text* behind
`kata verify`'s module-folder lock, to quote it accurately into a permanent
kumite ADR. A `.d.ts` cannot answer that — exactly the gap #143's entry
predicted ("anything that is not expressible in a signature or a doc comment
has no on-disk fallback"). What did answer it was reading
`~/Projetos/kata/docs/guide/project-layout.md` straight from the kata
checkout: two `grep` calls settled it.

**3. A concrete drift the lookup caught.** The task's whole premise came from
`kata-feedback/v1/module-lock-caught-a-misreading.md`, which cites the rule as
`schema-file-naming`. The doc's own enforcement line (`project-layout.md:151`)
names it **`kata/schema-file-naming`**, with the namespace. Trusting the
second-hand citation would have baked a subtly wrong rule ID into ADR-0001's
errata — a doc whose entire purpose is to stop a future planner from trusting
second-hand prose. Small, and slightly funny, but the exact failure mode the
task exists to prevent.

## Why it matters

The `~/Projetos/kata` checkout is a strictly better fallback than the bundled
`.d.ts` — it has the guide prose, the ADRs and the rule text, not just
signatures — but it only exists because this developer happens to have kata
cloned next door. A kumite agent on a machine without that checkout has, for
rule-text questions, no fallback at all once the MCP is down: not the `.d.ts`,
not the docs, nothing. Three sessions in, that is no longer a fluke to route
around; the MCP being up is currently load-bearing for any kata question that
isn't a type signature.

Worth noting for triage: the docs *content* was not the problem in any of these
sessions. `project-layout.md`'s "The `src/` root is open" / "Module directories
stay locked" pair states the asymmetry plainly and the enforcement line names
the rule ID exactly. The delivery mechanism is what keeps failing.

## Metrics

- kata-docs queries: **0** (server unavailable). Round-trip cost: 0 tokens.
- Fallback cost: **2 Bash calls** (`ls` the kata docs dir, then one combined
  `grep -n`/`grep -A` over `project-layout.md`), roughly 1.5k tokens of a
  ~45k-token planning session — call it **3%**. Cheaper than the #143 fallback
  (4 calls, ~9%) because the docs are prose and greppable, where the `.d.ts`
  hunt needed a `find` first.
- Did the fallback pay off: **yes**. It corrected a rule ID (`kata/`-namespaced)
  that the plan would otherwise have copied wrong from a prior kumite feedback
  entry, into a permanent ADR.
- Turn friction: none attributable to kata. No `kata verify` run this session
  (planning writes no code); the task is docs-only and touches no back code.

## Suggested fix (optional)

Nothing in the framework's code. One escalation for whoever triages: this is
the third consecutive planning session lost by `kata-docs`, and the previous
entry already asked for a hard, visible failure instead of silent absence.

One guess ruled out from here: the package resolves fine.
`npm view @katajs-framework/docs-mcp version` answers **0.1.5**, so kumite's
`.mcp.json` startup path (`npx -y @katajs-framework/docs-mcp`) is not failing
on a missing or unpublished package. That points the investigation at the
server's own startup/handshake rather than at distribution — and it means the
next person to look at this can skip the registry.

Also worth weighing: at **0.1.5**, the docs MCP is versioned far behind the
framework it documents (`@katajs-framework/core@0.4.2`). Whether that's
intentional or a stale publish, a consumer has no way to tell which kata
version the server would answer for — which is one more reason the source
checkout, version-locked and on disk, keeps winning when it's available.
