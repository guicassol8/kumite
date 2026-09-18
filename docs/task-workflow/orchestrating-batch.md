# Orchestrating a batch

Run **2–3 issues end to end in one session** by delegating every step to a
subagent with a fresh context. Conventions in `docs/workflow.md`; what each
step actually does stays in its own doc — this one only says who runs it, in
what order, and where the user is asked.

**Not for:** a single task (run the five steps, one session each), and never
for doing a step yourself. The orchestrator does not plan, does not write
code and does not review.

## Why this does not break "one step, one session"

That rule protects **context isolation**: a step must not inherit the working
context of the step before it. Batch mode keeps that intact — the isolation
boundary moves from the session to the subagent. The orchestrator's own
context holds only the batch state, the user's decisions and the relay; each
step runs in an agent spawned for it and discarded after it. A step's agent is
never reused for another step, and never for another issue.

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
orchestrator's own context; it is two `gh` calls and the result is needed for
every later decision.

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

Spawn each with `subagent_type: claude`, the default model (see § Model),
running in the background, and this prompt:

```text
Your first action: invoke the planning-tasks skill and follow
docs/task-workflow/planning-tasks.md to the letter for issue #<N>.

You have NO access to the user. When Step 2 needs a decision you cannot
resolve from the issue, the repo conventions or code evidence, do not guess
and do not block: keep investigating everything that does not depend on the
answer, and end your final report with a `## PERGUNTAS` block — each question
with 2–4 concrete options and your recommendation.

Post the plan as a `## Plan` comment on the issue AND return its full text in
your final report; the orchestrator relays it to the user, who cannot see
your report.

If you consult the kata-docs MCP server or kata's docs, follow AGENTS.md
§ Kata framework feedback (a `kata-feedback/` entry when kata was genuinely
in frame, one LEDGER.csv line otherwise).

End with the canonical handoff line from the doc.
```

## Step 3 — Questions, then approval

**Questions.** Wait for every planner to report, then put all their questions
into a **single** batched round for the user, options and recommendation
included. Send the answers back with `SendMessage` to the **same agent** — its
investigation is the reason the question exists; a new agent would re-derive
it from nothing.

**Approval.** With the plans posted, show the user each plan **in full**, and
take approval issue by issue: approve / adjust / drop from the batch.
"Adjust" goes back to the same planner by `SendMessage`, which edits the same
comment (`gh issue comment --edit-last`) — never a second `## Plan`.

No issue advances to Step 4 without the user's explicit approval. Record each
approval in the state file; it is what the implementation prompt asserts.

## Step 4 — Implement → review → merge, one issue at a time

**Never run two implementations in parallel.** Worktrees share CPU, RAM and
the local Postgres; two suites truncating the same database produce phantom
failures and OOM-killed commits (#288). Each issue completes the whole cycle —
implemented, reviewed, merged — before the next one starts.

### 4a — Implementation

A new agent, `isolation: "worktree"`:

```text
Your first action: invoke the implementing-tasks skill and follow
docs/task-workflow/implementing-tasks.md for issue #<N>.

The approved plan is the `## Plan` comment on the issue. I confirm the user
approved it in this session — treat the approval precondition as satisfied.

Worktree: EnterWorktree branches from origin/main and this repo integrates on
develop. Right after entering, with a clean tree, `git fetch origin && git
reset --hard origin/develop`, then rename the branch to `task/<N>-<slug>`.
Run `pnpm install` inside it — node_modules are per-worktree. If you need to
run the app or Postgres, override the ports (`PORT`, `--port`, `VITE_API_URL`,
`DB_PORT` in that worktree's `.env`); the defaults collide with other
worktrees.

Conventional commits, never in the background: the Stop hook runs the suite in
parallel with the pre-commit and both truncate the same database. A commit
killed with exit 137 is OOM — retry it as `VITEST_MAX_THREADS=2 git commit …`.

The durable deliverable is the PR on origin (`gh pr create --base develop`,
body starting with `Fixes #<N>` and ending with `## Evidence`). Push
everything before you finish — your worktree is disposable.

Final report: the PR number and URL, what changed, which gates passed, and any
out-of-scope discovery (which becomes a new "Discovered from #<N>" issue,
never extra scope here).
```

Relay the PR and the summary to the user as soon as it returns.

### 4b — Review

A new agent, **no** `isolation` — it manages its own worktree:

```text
Your first action: invoke the reviewing-tasks skill and follow
docs/task-workflow/reviewing-tasks.md for PR #<PR>.

Stage 0 says to inspect `git worktree list --porcelain` first: the
implementation worktree may still exist with that branch checked out. In that
case use a detached worktree plus an explicit push, never a forced checkout.

Evidence is mandatory and blocking: front → a Playwright walkthrough with
screenshots under `front/e2e/evidence/<issue>/`, referenced step by step in
the PR body; back → trimmed `pnpm -r test` and hurl output.

E2E care in this repo: re-seed after every commit (the pre-commit truncates
the database), use `--workers=1` for probe runs (exit 137 is OOM, not a
regression), and run `pnpm evidence:restore <issue>` before committing so you
do not commit evidence of older issues that the suite overwrote.

Fix every finding you can fix safely, in this same session, on the PR branch.
Hand back only what needs a fresh plan or a product decision.

Do NOT merge — the merge is the user's call and the orchestrator asks for it.

Final report: the Acceptance compliance table, findings and what you fixed,
the evidence paths, and the verdict (approved / changes requested).
```

Relay the verdict and the evidence paths to the user.

### 4c — Merge, on the user's word

Ask explicitly, then:

```bash
gh pr merge <PR> --squash          # no --delete-branch: it fails while the
                                   # branch is checked out in a worktree
gh issue close <N> --reason completed
pnpm worktree:prune                # from the main checkout; --dry-run first
git branch -D task/<N>-<slug>      # only if it survived the prune
```

`reviewing-tasks.md` § Verdict prints `--delete-branch`; in batch mode the
implementation worktree is usually still around, so drop the flag and let
`pnpm worktree:prune` do the cleanup. The PR targets `develop`, not the
default branch, so `Fixes #N` does not auto-close — close it explicitly.

Update the state file to `merged` before starting the next issue.

### When the review requests changes

Report the findings and ask how to proceed: a new implementation agent
carrying the findings, a fresh planner for a new plan (back to Step 2 for that
issue alone), or drop it from the batch and keep going. Never decide this
alone — an unfixable finding usually hides a product decision.

## Relay — what reaches the user

The user never sees a subagent's report, so:

- **plans: in full**, verbatim, because approval depends on them;
- implementation and review: a summary, the PR link, the evidence paths and
  which gates ran;
- questions: never summarized away — options and recommendation intact;
- the verdict and every finding, fixed or open.

## Model

Every subagent runs on the session's default agent model. Escalating one
issue's step to a bigger model is the user's call — ask, naming the issue and
why it is harder than the rest.

## Step 5 — Handoff (MANDATORY)

Close with the batch summary — issues closed, PRs merged, evidence paths,
discoveries that became new issues — and, as the very last thing, the literal
handoff line:

```
Next: run another batch.
```

If an issue was left unfinished (review not accepted, merge postponed), say so
in one line and print that issue's own next step instead. Never end with a
prose suggestion alone — end with the literal handoff line.
