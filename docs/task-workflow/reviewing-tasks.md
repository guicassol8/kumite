# Reviewing a task

A review is only done when compliance is checked, quality is checked,
**every finding the reviewer can safely fix has been fixed**, and
**evidence exists**. Conventions in `docs/workflow.md`.

Findings are fixed in this same session, on the PR branch, not handed off —
see § Fixing findings. Loop back to implementing the task only for a gap that
needs a product/design decision the reviewer can't make alone, or that's
large enough to warrant its own plan.

## Stage 0 — Check out the PR in its own worktree

Reviews never run in the main checkout (other agents may be working there):

```bash
git fetch origin
git worktree add .worktrees/review-<PR> task/<N>-<slug>
cd .worktrees/review-<PR>
pnpm install
```

Everything below — reading, running the app, committing evidence — happens
inside this worktree. When the review ends (merged or handed back):
`git worktree remove .worktrees/review-<PR>`.

## Stage 1 — Spec compliance

- `gh pr view <PR> --comments` + `gh pr diff <PR>` + the linked issue.
- Walk the issue's Acceptance line by line and produce a table:
  `✅ met / ❌ not met / 🔲 can't verify from the diff`.
- Any ❌ that's a well-scoped code gap → fix it now (§ Fixing findings), then
  re-walk the table. Any ❌ that turns out to hinge on an ambiguous or
  conflicting Acceptance line (ask, don't assume) → surface the exact tension
  to the user before writing a single line of fix code; do not silently pick
  an interpretation. Only hand back to implementing the task when the gap
  needs a fresh plan (new schema/route shape, cross-module redesign) — not
  merely because a fix exists.

## Stage 2 — Quality

Review the diff only (not the whole repo) for:
- correctness and error paths;
- kata idioms in back (schemas in `.schema.ts`, `c.error(...)` for errors,
  services pure — `kata verify` catches most, look for what it can't).
  Consult the kata-docs MCP server first for any of these idioms you're
  unsure about, falling back to reading `~/Projetos/kata` directly if it's
  unavailable or fails;
- AI-regression smells: unrelated deletions, ghost imports, weakened
  assertions, swallowed errors, `any`;
- test quality (asserting behavior, not implementation) and i18n catalog parity.

## Fixing findings

A finding survives review only if it's also fixed — a comment describing a
bug and stopping there is an incomplete review, not a deliverable. For every
Stage 1 or Stage 2 finding, in the review worktree, on the PR branch:

1. If the fix is a genuine judgment call — it reinterprets an Acceptance
   line, trades off two valid designs, or touches product behavior beyond
   what the diff already does — stop and ask the user (batched, with a
   recommendation) before writing code. Do not silently resolve a spec
   tension in either direction.
2. Otherwise, fix it: smallest change that closes the gap, tests updated or
   added alongside it, same conventions as implementing a task (TDD where
   it fits, conventional commits, no scope creep beyond the finding itself).
3. Re-run the full gate ladder (`pnpm -r typecheck`, `pnpm verify`,
   `pnpm -r test`, plus hurl for back changes) before moving on.
4. Commit the fix on the PR branch with a conventional commit message and
   push it — this updates the existing PR, it does not open a new one.
5. Re-derive the Stage 1 table and Stage 2 notes against the fixed diff
   before writing the review comment, so what's posted reflects the PR as
   it now stands, not as it stood before the fix.

A finding that isn't safely fixable in-session (needs a product decision, or
is large enough to need its own plan) stays a documented gap — say so
explicitly, don't fix it partially.

## Stage 3 — Evidence (MANDATORY, blocking)

**Front-touching PRs — visual walkthrough** (all inside the review worktree):
1. Boot the stack (`docker compose up -d`; Playwright's webServer boots
   back + front on its own). If another instance is already running, override
   the ports in this worktree's `.env` files.
2. Drive every changed flow via a Playwright spec in `front/e2e/`
   (extend or add one), asserting through `data-testid`.
3. Screenshot each meaningful final state to
   `front/e2e/evidence/<issue>/<nn>-<state>.png` and commit them on the PR branch.
4. Write the walkthrough in the PR's `## Evidence`: step → expected → screenshot
   path, in order.

**Back-touching PRs:**
1. `pnpm -r test` — paste trimmed output.
2. Server up (`pnpm dev:back`) → `pnpm --filter @kumite/back hurl` — paste
   trimmed output.

No evidence = the review is NOT done. Say exactly that rather than approving.

## Verdict

- **Approve**: comment with the compliance table + evidence links (call out
  any fixes made during review, with their commits) then merge only with the
  user's explicit go-ahead: `gh pr merge --squash --delete-branch`. The PR
  targets `develop`, not the repo's default branch, so `Fixes #N` does
  **not** auto-close the issue — close it explicitly:
  `gh issue close <N> --reason completed`.
- **Request changes**: only for a finding left unfixed per § Fixing
  findings (needs a fresh plan, or the user chose not to fix it now) —
  precise, file-level items on the PR.

## Kata feedback (attempt every time)

Stage 2 reads the diff for kata idioms — attempt a `kata-feedback/` entry
before the handoff, not gated on finding a violation. A PR that used kata
cleanly, or a lint rule that caught (or missed) something real, is still
signal. See `AGENTS.md` § Kata framework feedback and
`kata-feedback/README.md` for the format.

## Handoff (MANDATORY)

The next step runs in a **fresh session**, so the very last thing you print is
a plain, ready-to-open line for that session.

Approved and merged (the issue is closed; on to the next task):

```
Next: pick the next task.
```

Changes requested (the number is the **issue**, not the PR — the fix continues
that task):

```
Next: implement issue #12.
```

Still blocked on the user's go-ahead to merge? Say that in one line, and print
the "pick the next task" line anyway as the step after it. Never end with a
prose suggestion alone — end with the literal handoff line.
