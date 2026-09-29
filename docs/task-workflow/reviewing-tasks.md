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

First inspect the PR head branch (`gh pr view <PR> --json headRefName`) and
`git worktree list --porcelain` from the main checkout. Git cannot check out
one branch in two worktrees.

- If its implementation worktree already has the PR branch checked out, reuse
  that dedicated worktree when it is clean and idle. Do not remove it at review
  completion; its lifecycle belongs to the implementation task.
- If it is dirty or another agent is using it, do not change or detach it.
  Coordinate ownership before editing the PR branch. A separate detached
  worktree at the fetched PR head can be used for read-only inspection meanwhile.
- If the branch is not checked out elsewhere, create the review worktree:

```bash
git fetch origin
git worktree add .worktrees/review-<PR> <pr-head-branch>
cd .worktrees/review-<PR>
pnpm install
```

Before reviewing any existing local PR branch, fetch and fast-forward it to
the remote PR head in the selected clean, idle worktree. Resolve divergence
explicitly instead of reviewing stale code.

If the branch exists only on the remote, create its local tracking branch with
`git worktree add --track -b <pr-head-branch> .worktrees/review-<PR> origin/<pr-head-branch>`.

Everything below — reading, running the app, producing evidence — happens
inside the selected dedicated worktree. Remove only a worktree created by this
review, after preserving all changes and following the compose cleanup in
`docs/workflow.md`. Run removal from the main checkout, not inside the worktree.

## Stage 1 — Spec compliance

- `gh pr view <PR> --comments` + `gh pr diff <PR>` + the linked issue.
- Walk the issue's Acceptance line by line and produce a table:
  `✅ met / ❌ not met / 🔲 can't verify from the diff`.
- **The PR body is a contract** (#403): list every claim it makes — what
  changed, what is tested, what is out of scope — and check each one
  against the code. A claim the diff does not back is a finding, the same
  as an unmet Acceptance line.
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
  For an idiom you're unsure about, read kata's docs (`AGENTS.md` § Kata
  framework feedback);
- AI-regression smells: unrelated deletions, ghost imports, weakened
  assertions, swallowed errors, `any`;
- test quality (asserting behavior, not implementation) and i18n catalog parity.

### Targeted mutants (#403)

The defect that escapes most often is a test that passes with the wrong
implementation. For each new rule the diff adds — a condition, a guard, a
boundary, a status code, a filter — make one mutant by hand: invert the
condition, delete the guard, move the boundary by one. Run only the tests
that cover it. A mutant no test kills is a finding: add or fix the test
(§ Fixing findings). Revert every mutant (`git checkout -- <file>`); never
commit one.

Cap it at 3–5 mutants per PR, on the rules that matter most. Record the
score in the Evidence — `mutants: <killed>/<made> killed` — with one line
per mutant: `file:line`, what changed, the test that killed it. A PR with no
new rule (docs, config, copy) says `mutants: n/a` and why.

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
4. Commit the fix on the PR branch with a conventional commit message. Push
   all the review's fixes together, once — each push to the open PR is a
   CI run, and the pre-push re-runs the ladder (10-minute timeout). This
   updates the existing PR, it does not open a new one.
5. Re-derive the Stage 1 table and Stage 2 notes against the fixed diff
   before writing the review comment, so what's posted reflects the PR as
   it now stands, not as it stood before the fix.

A finding that isn't safely fixable in-session (needs a product decision, or
is large enough to need its own plan) stays a documented gap — say so
explicitly, don't fix it partially.

## Verifying the fixes (#403)

You wrote those fixes, so you are the worst judge of them: a model misses
its own errors far more often than the same errors attributed to someone
else. When any fix you committed touches production code — anything outside
tests, `e2e/`, docs and `kata-feedback/` — a fresh agent checks those
commits before the verdict. Note the range: `<head before your first
fix>..<head after your last fix>`.

- **Standalone review session**: spawn the `fix-verifier` agent
  (`.claude/agents/fix-verifier.md`) with the PR number and the range.
- **As a subagent** (batch mode): a subagent cannot spawn another — put the
  range in your final report; the orchestrator runs the verifier
  (`orchestrating-batch.md` § 4b).

A defect the verifier reports is fixed and verified again the same way; a
third round goes to the user. Fixes only to tests, docs or evidence skip
this step.

## Stage 3 — Evidence (MANDATORY, blocking)

**Front-touching PRs — visual walkthrough** (all inside the review worktree):
1. Boot the stack (`docker compose up -d`; Playwright's webServer boots
   back + front on its own). If another instance is already running, override
   the ports in this worktree's `.env` files.
2. Drive every changed flow via a Playwright spec in `front/e2e/`
   (extend or add one), asserting through `data-testid`.
3. Screenshot each meaningful final state to
   `front/e2e/evidence/<issue>/<nn>-<state>.png`. That folder is git-ignored
   (#402): every spec rewrites its own issue's folder on each run, and
   nothing under it is ever committed. Empty your issue's folder
   (`rm -rf front/e2e/evidence/<issue>`) before the run: a screenshot left
   from an earlier run no longer shows in `git status`, and step 4 attaches
   every PNG in the folder, appending the unreferenced ones to the comment.
4. Publish the walkthrough as a PR comment with the screenshots **attached**:
   write the steps in order — step → expected →
   `![<state>](./<nn>-<state>.png)` — into a Markdown file outside the repo,
   then, from inside `front/e2e/evidence/<issue>/`:

   ```bash
   gh pr comment <PR> --body-file <file>.md $(printf -- '--attach %s ' *.png)
   ```

   `gh` uploads each PNG (up to 50 per command) and rewrites every
   `./<name>.png` reference to the uploaded asset; it prints the comment's
   URL. Link that URL from the PR body's `## Evidence`, next to the text
   outputs. The review comment itself may carry the attachments.
5. No regression elsewhere: CI no longer runs the e2e suite on a PR push
   (#378, `docs/workflow.md` § Gate ladder), so you prove it. Run the
   **whole** suite locally with `CI=1` on the PR's head (organizer
   credentials exported, freshly seeded database, or the gated specs skip
   silently), or dispatch it with `gh workflow run CI --ref <branch>` when
   the workflow is enabled. Paste the pass/flaky/skip counts in the
   Evidence and name any flaky spec.

**Back-touching PRs:**
1. `pnpm -r test` — paste trimmed output.
2. `pnpm --filter @kumite/back db:reset` — the hurl suite is not re-runnable
   on a dirty database (it asserts on seed state, and vitest leaves rounds,
   teams and `event_config` behind). The script refuses any non-local
   `DATABASE_URL`, so it is safe to run without checking first.
3. Server up (`pnpm dev:back`) → `pnpm --filter @kumite/back hurl` — paste
   trimmed output. Start that server *fresh*: `db:reset` empties the database,
   not the API process, and the anti-abuse windows (the per-IP bug-report
   cooldown, the password-reset ones) live in memory. Re-running the suite
   against a warm server fails `bug-reports.hurl` on the cooldown alone, with
   a clean database.

No evidence = the review is NOT done. Say exactly that rather than approving.

## Verdict

First read `gh pr checks <PR>`. A red `check` on the code is a finding. A
`check` that did not run — out of Actions minutes, GitHub fails the job
without starting it ("The job was not started because…") — is not green:
the Evidence then carries the full local ladder (`pnpm -r typecheck`,
`pnpm verify`, `pnpm -r test`) run on the PR's head, and the verdict says
that `check` did not run (#399).

- **Approve**: comment with the compliance table, the evidence links, the
  mutant score and the fix verifier's result when it ran (call out
  any fixes made during review, with their commits) then merge only with the
  user's explicit go-ahead: `gh pr merge --squash --delete-branch`.
  `develop` is the default branch (#400), so `Fixes #N` closes the issue on
  merge — confirm with `gh issue view <N> --json state`, and run
  `gh issue close <N> --reason completed` only if it stayed open. Then,
  from the main checkout, `pnpm worktree:prune` removes the merged branch's
  worktree and its Postgres (and any other merged, clean one left behind).
- **Request changes**: only for a finding left unfixed per § Fixing
  findings (needs a fresh plan, or the user chose not to fix it now) —
  precise, file-level items on the PR.

## Kata feedback

Before the handoff, a `kata-feedback/` report or a `LEDGER.csv` line, per
`AGENTS.md` § Kata framework feedback.

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
