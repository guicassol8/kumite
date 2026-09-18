---
name: orchestrating-batch
description: Runs a batch of 2–3 GitHub Issues end to end in one session — picks the batch, then delegates planning, implementation and review to fresh-context subagents, relaying plans, PRs, evidence and verdicts to the user and stopping for every approval. Triggers: "roda um lote", "orquestra as tasks", "pega 2 tasks e faz", "pega 3 issues do começo ao fim", "modo lote", "run a batch", "batch these issues", "orchestrate the next tasks".
---

# Orchestrating a batch

@docs/task-workflow/orchestrating-batch.md

## Claude Code specifics

- **Arguments**: none → assemble the batch from READY work; `#N #M` → validate
  the given issues and batch those.
- **State**: `batch-state.md` in this session's scratchpad directory.
- **Subagents**: `Agent` with `subagent_type: "claude"`. Planners
  (`run_in_background: true`, all at once); implementation with
  `isolation: "worktree"`; review with no isolation. Answers to a planner's
  `## PERGUNTAS` go back with `SendMessage` to the same agent — a new `Agent`
  call starts cold and loses the investigation.
- **Worktree base**: `EnterWorktree` and `isolation: "worktree"` branch from
  `origin/main`, and this repo integrates on `develop` — the implementation
  prompt must tell the agent to `git fetch origin && git reset --hard
  origin/develop` right after entering, before any edit.
- **Never** spawn two implementation agents at once, and never reuse one
  step's agent for the next step.
- Use `AskUserQuestion` for the three blocking gates — batch confirmation,
  plan approval (one at a time), merge authorization — batched, with options
  and a recommendation.
- The user does not see subagent reports: relay plans **in full**, and
  summaries + PR links + evidence paths for everything else.
- Handoff (MANDATORY): the next batch runs in a **fresh chat**, so the very
  last thing you print is the command to paste there — alone in a fenced
  block, nothing after it:

  ```
  /orchestrating-batch
  ```

  If an issue was left unfinished, print its own next command instead
  (`/implementing-tasks #12`, `/reviewing-tasks #34`). Never end with a prose
  suggestion — end with the command itself.
