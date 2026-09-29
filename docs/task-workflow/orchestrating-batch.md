# Orchestrating a batch

Run **2–3 issues end to end in one session** by delegating every step that
plans, writes code or reviews to a subagent with a fresh context. Conventions
in `docs/workflow.md`; what each step actually does stays in its own doc —
this one only says who runs it, in what order, and where the user is asked.

**Not for:** a single task (run the five steps, one session each), and never
for doing a step yourself. The orchestrator does not plan, does not write
code and does not review.

## Why this does not break "one step, one session"

That rule protects **context isolation**: a step must not inherit the working
context of the step before it. Batch mode keeps that intact — the isolation
boundary moves from the session to the subagent. The orchestrator's own
context holds only the batch state, the user's decisions and the relay;
planning, implementation and review each run in an agent spawned for them and
discarded after. A step's agent is never reused for another step, and never
for another issue. Picking (Step 1) is the exception the orchestrator keeps:
its output *is* the batch state, and it writes nothing before the user
confirms.

Approval still does not cross a boundary: a subagent cannot see the user's
approval, so the orchestrator states it explicitly in the prompt it writes.

## Preconditions

- `git fetch origin` before any analysis — a stale main checkout has already
  cost two public replans (#229, #203).
- The main checkout stays clean. The orchestrator edits no files anywhere: it
  runs `gh`, reads, and spawns agents. All file work happens in the
  subagents' worktrees.
- If git or `gh` over SSH times out, use `gh auth token` over HTTPS and wrap
  `gh` calls in a short retry.

## Step 0 — Batch state

Keep one state file in the session's scratchpad directory, `batch-state.md`.
Write it when the batch is confirmed, update it **after every phase
transition** and before reporting to the user, and re-read it when the skill
is reinvoked — a batch outlives a context window.

```markdown
# Batch 2026-09-18
| Issue | Slug | Phase | PR | Notes |
|---|---|---|---|---|
| #276 | movemember-tx | merged     | #301 | closed 14:20 |
| #281 | sandbox-verdict | approved | —    | plan approved by user 14:05 |
| #273 | cors-appbaseurl | picked   | —    | planner running |
```

Phases: `picked` → `planned` → `approved` → `implemented` → `reviewed` →
`merged`. On reinvocation, resume from the recorded phase instead of
restarting the batch; confirm the resumed state with the user in one line.

## Step 1 — Assemble the batch

**With issue numbers given** (`#273 #281`): validate each one against the
READY definition in `docs/workflow.md` § Ready work. Report any that fails
(closed, `epic`, `blocked`, open "Blocked by", already linked to an open PR)
and leave it out rather than carrying it.

**With no arguments**: compute READY and rank exactly as
`picking-next-task.md` Steps 1–2 describe — run those queries here, in the
orchestrator's own context, since the result is needed for every later
decision. Two `gh list` calls plus one `gh issue view <n> --json state` per
"Blocked by" reference: that last check is what keeps a blocked issue out of
the batch, so do not skip it.

Then apply the **coherence test**, which is what makes a batch a batch: no
two issues may touch the same files, modules, screens or migrations — or they
must overlap so completely that they belong on one track. The cost of getting
this wrong is a merge conflict and rework in the middle of a sequential run.
Target 2–3; hand back 2 rather than forcing a colliding third.

Report: each issue (`#N — title`, priority, stack), what it unblocks, **why
the set holds together as a batch**, and the runner-ups in one line each. Ask
the user to confirm (accept / swap one / something else).

Nothing is written before that confirmation. On it:

```bash
gh issue edit <N> --add-assignee @me   # each issue in the batch
```

## Step 2 — Plan, in parallel

One planning agent per issue, all spawned at once: planning is reading, and
reading parallelizes safely. Implementation does not (Step 4).

Spawn each as a **`task-planner`** agent (`.claude/agents/task-planner.md`),
in the background. The agent carries the batch rules — no Edit/Write, no
access to the user (questions come back as a `## PERGUNTAS` block, ⚠️ on the
ones that matter most), the plan posted on the issue **and** returned in
full — so the prompt only names the issue:

```text
Plan issue #<N>.
```

## Step 3 — Questions, then approval

**Questions.** Wait for every planner to report, then put all their questions
into a **single** batched round for the user, options and recommendation
included. Send the answers back to the **same agent**, as a follow-up message
that keeps its context — its investigation is the reason the question exists,
and an agent spawned anew would re-derive it from nothing.

**Approval.** With the plans posted, show the user each plan **in full**, and
take approval issue by issue: approve / adjust / drop from the batch.
"Adjust" goes back to the same planner the same way, and it edits the same
comment (`gh issue comment --edit-last`) — never a second `## Plan`.

No issue advances to Step 4 without the user's explicit approval. Record each
approval in the state file; it is what the implementation prompt asserts.

## Step 4 — Implement → review → merge, one issue at a time

**Never run two implementations in parallel.** Worktrees share CPU, RAM and,
for the E2E, hurl and dev server, the local Postgres (#392 isolated only the
back suite). Each issue completes the whole cycle — implemented, reviewed,
merged — before the next one starts.

### 4a — Implementation

A **`task-implementer`** agent (`.claude/agents/task-implementer.md`): it runs
in its own worktree from `origin/develop` (declared in the agent), renames
the branch, pushes through the pre-push ladder, opens the PR and reports.
The prompt names the issue and asserts the approval the agent cannot see:

```text
Implement issue #<N>. The approved plan is the `## Plan` comment on the
issue; the user approved it in this session.
```

Relay the PR and the summary to the user as soon as it returns.

### 4b — Review, then the fix verifier

A **`task-reviewer`** agent (`.claude/agents/task-reviewer.md`), with no
harness-managed isolation — Stage 0 of the review has it choose its own
worktree. The agent carries the rules: evidence attached to the PR, targeted
mutants, one push for all fixes, `gh pr checks`, never merge.

```text
Review PR #<PR> (fixes issue #<N>).
```

E2E care to add to that prompt when the PR touches the front: re-seed
(`db:reset`) before each full run — the suite asserts on seed state and
leaves data behind — and use `--workers=1` for probe runs (exit 137 is OOM,
not a regression).

**Fix verifier.** When the reviewer's report carries a fix range (a fix
touched production code), spawn a **`fix-verifier`** agent
(`.claude/agents/fix-verifier.md`):

```text
Verify the review fixes on PR #<PR>: <from>..<to>.
```

A defect it reports goes back to the **same** reviewer (`SendMessage`, it
keeps the context), and the new fixes are verified again the same way; a
third round goes to the user. No fix range → no verifier.

Relay the verdict, the mutant score, the verifier's result and the Evidence
link to the user.

### 4c — Merge, on the user's word

Before asking, read `gh pr checks <PR>`: a `check` that did not run (out of
Actions minutes) is not green — the merge then rests on the full local
ladder in the Evidence, and the question says so. Ask explicitly, then:

```bash
gh pr merge <PR> --squash          # no --delete-branch: it fails while the
                                   # branch is checked out in a worktree
gh issue view <N> --json state     # Fixes #N closed it (develop is the default)
pnpm worktree:prune                # from the main checkout; --dry-run first
git branch -D task/<N>-<slug>      # only if it survived the prune
```

`reviewing-tasks.md` § Verdict prints `--delete-branch`; in batch mode the
implementation worktree is usually still around, so drop the flag and let
`pnpm worktree:prune` do the cleanup. `develop` is the default branch (#400),
so `Fixes #N` closes the issue on merge; `gh issue close <N> --reason
completed` only if it stayed open.

Update the state file to `merged` before starting the next issue.

### When the review requests changes

Report the findings and ask how to proceed: a new implementation agent
carrying the findings, a fresh planner for a new plan (back to Step 2 for that
issue alone), or drop it from the batch and keep going. Never decide this
alone — an unfixable finding usually hides a product decision.

## Relay — what reaches the user

The user never sees a subagent's report, so:

- **plans: in full**, verbatim, because approval depends on them;
- implementation and review: a summary, the PR link, the Evidence link and
  which gates ran;
- questions: never summarized away — options and recommendation intact;
- the verdict and every finding, fixed or open.

## Model

Every subagent runs on the session's default agent model. Escalating one
issue's step to a bigger model is the user's call — ask, naming the issue and
why it is harder than the rest.

## Step 5 — Handoff (MANDATORY)

Close with the batch summary — issues closed, PRs merged, Evidence links,
discoveries that became new issues — and, as the very last thing, the literal
handoff line:

```
Next: run another batch.
```

If an issue was left unfinished (review not accepted, merge postponed), say so
in one line and print that issue's own next step instead. Never end with a
prose suggestion alone — end with the literal handoff line.
