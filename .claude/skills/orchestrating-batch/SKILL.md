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
- **Subagents**: `Agent` with the role agents in `.claude/agents/` —
  `task-planner` (`run_in_background: true`, all at once), `task-implementer`
  (its own worktree, declared in the agent), `task-reviewer`, and
  `fix-verifier` when the review fixed production code. Answers to a
  planner's `## PERGUNTAS` and a verifier's defects go back with
  `SendMessage` to the same planner or reviewer — a new `Agent` call starts
  cold and loses the investigation.
- **Worktree base**: `EnterWorktree` and `isolation: "worktree"` branch from
  the remote's default branch, `develop` (#400); the implementation agent
  only renames its branch to `task/<N>-<slug>`. The worktree is cut from
  this session's clone, so the stale-clone check is yours, before the first
  implementation spawn: if `git rev-parse --abbrev-ref origin/HEAD` in the
  main checkout still says `origin/main`, run `git remote set-head origin
  --auto` once — the agent's own skill reads that caveat too late.
- **Never** spawn two implementation agents at once, and never reuse one
  step's agent for the next step.
- Use `AskUserQuestion` for the three blocking gates — batch confirmation,
  plan approval (one at a time), merge authorization — batched, with options
  and a recommendation.
- The user does not see subagent reports: relay plans **in full**, and
  summaries + PR links + Evidence links for everything else.
- Handoff (MANDATORY): the next batch runs in a **fresh chat**, so the very
  last thing you print is the command to paste there — alone in a fenced
  block, nothing after it:

  ```
  /orchestrating-batch
  ```

  If an issue was left unfinished, print its own next command instead
  (`/implementing-tasks #12`, `/reviewing-tasks #34`). Never end with a prose
  suggestion — end with the command itself.
