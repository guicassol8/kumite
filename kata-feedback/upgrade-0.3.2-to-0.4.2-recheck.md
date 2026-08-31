# Upgrading core 0.3.2 → 0.4.2: non-breaking, but not docs-only either

**Found while**: routine dependency upgrade (`@katajs-framework/core`
`^0.3.2` → `^0.4.2`), user's stated assumption going in was "kata só deve
ter atualizado docs."
**Where in kata**: release commits `fc4fa23` (0.4.0), `8b64d14` (0.4.1),
`f483adb`/`baf8b4a` (0.4.2); `packages/kata/src/{context,hono-bridge,jwt}`,
`packages/verify/src/rules/no-raw-boundary-cast.ts`.

## What

The assumption was wrong, though the practical impact on kumite was zero.
0.4.0 is a real minor bump: two new public exports (synthetic OPTIONS
preflight per ADR-0020, `fromHonoTransform()` response-transform seam) plus
two internal-only changes — a context/dispatch perf refactor (#163) and the
ADR-0025 migration that contains every Hono-boundary `as never` cast inside
one new `hono-bridge.ts` shim (previously scattered `// kata-allow:
hono-boundary` markers). `no-raw-boundary-cast` (a `kata verify` rule) was
rewritten accordingly: a raw `as never` outside a file literally named
`hono-bridge.ts` is now a hard error. 0.4.1 and 0.4.2 *are* docs/CLI-scaffold
only (six doc-feedback fixes to `kata init`'s generated templates, then one
`kata init --with-docs-mcp` message fix) — so the assumption was half right,
just off by one release.

None of it touched kumite: `grep -rn "as never" back/src` and `grep -rln
"kata-allow" back/src` both came back empty, so the rewritten verify rule has
nothing to flag here. `zod` peer stayed `^3`. Post-upgrade
`pnpm -r typecheck` / `kata verify --strict-coverage` (33 files) /
`pnpm -r test` (228 tests across blocks+back+front) all green, no code
changes needed in kumite beyond the version bump itself.

One real (if minor) kata-adjacent bug this surfaced: kumite's own
`back/AGENTS.md` and `back/docs/adr/README.md` linked kata's ADR docs at
`.../kata/tree/v0.3.2/docs/adr` — missing the `katajs-` tag prefix, so the
link was already 404ing even before the version went stale. Confirmed via
`git tag -l` that the actual tag is `katajs-v0.3.2`, not `v0.3.2`. This is
the exact bug class kata's own 0.4.1 release fixed in its `kata init`
scaffold output (#301, "framework-ADR link ... points at the actual
`katajs-v{version}` release tag instead of a nonexistent `v{version}` ref")
— kumite's docs just predate that fix and were never regenerated. Fixed here
to `.../tree/katajs-v0.4.2/docs/adr`.

## Why it matters

For anyone budgeting a "just bump the version" task as trivial because the
last few releases *were* patch/docs-only: check the minor version boundary
specifically, not just "how many releases since I last upgraded." A minor
bump can carry new public API surface and rewritten lint rules even in a
0.x line: worth a real diff review (commit messages were unusually precise
here — each release commit named exactly which ADRs/issues motivated it —
which made this check fast) rather than a changelog skim, but slow if kata's
release commits weren't this well-annotated.

## Metrics

- Zero `kata-docs` MCP tokens spent identifying *what changed* — that came
  from `git fetch`+`log`+`diff` against the local kata clone
  (`~/Projetos/kata`, which turned out stale and needed `git fetch --all
  --tags` first) and reading the three release commit messages, not from the
  docs server.
- ~6 `search_docs`/`read_doc` calls, all spent re-verifying the *existing*
  feedback entries (204, array-output, 422-vs-400, JWT) still hold against
  current docs — see the per-file recheck below. That part paid for itself:
  live-doc re-reads are cheaper and more reliable than re-deriving from
  memory whether a stale finding is still true.
- No hurl run performed (needs a running server + `docker compose up`, not
  part of the automated gate ladder) — typecheck/verify/tests only.

## Recheck of standing kata-feedback entries against 0.4.2 docs

- `verify-on-schema-only-module.md` — still holds; `kata verify
  --strict-coverage` ran clean post-upgrade (33 files, 0 problems), same as
  every prior confirmation.
- `204-no-content-doc-paid-off.md` — still holds; `guide/routes-schemas.md`'s
  "204 No Content" section is materially unchanged (`output: { 204:
  NoContentSchema }` / `c.json(undefined, 204)`), re-read in full to confirm.
- `array-output-schema-docs-gap.md` — still holds, not fully closed. A new
  example landed since filing (`guide/routes-schemas.md`'s
  `z.coerce.boolean()` section, added for an unrelated reason) that uses
  `output: TodoListSchema` on a list route — but never spells out
  `TodoListSchema = z.array(TodoSchema)`, so the original suggested fix (one
  explicit sentence confirming `z.array(...)` is a supported `output`) is
  still not stated anywhere in the indexed docs.
- `errors-vs-issue-status-mismatch.md` — still holds, unchanged. Diffed
  `guide/errors.md`'s "What's automatic vs. what you write" table against
  the `katajs-v0.3.2` tag directly: byte-identical. The 422-vs-400 mapping
  is technically present in that table, so the underlying complaint is
  about discoverability (nothing links from "writing acceptance criteria"
  to that table), not missing information — same gap as when filed.
- `jwt-docs-worth-the-tokens.md` — still holds, and slightly reinforced:
  0.4.1 added a `docs(jwt): endorse colocating claims when there is no users
  domain` clarification to the same "endorsed layout" callout this entry
  praised. The internal `jwt/index.ts` changes in this range (ADR-0025
  boundary-cast migration) are implementation-only — `signJwt`/`jwtAuth`/
  `resolve`/`guard` signatures and behavior are untouched.
