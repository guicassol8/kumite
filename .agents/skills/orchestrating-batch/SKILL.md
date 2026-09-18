---
name: orchestrating-batch
description: Run a batch of 2–3 ready kumite issues end to end, delegating each step to a fresh-context subagent. Use when asked to take several tasks through the whole workflow in one session.
---

# Orchestrating a batch

Read and follow [the canonical workflow](../../../docs/task-workflow/orchestrating-batch.md)
and [repository conventions](../../../docs/workflow.md). Resolve these links
relative to this skill directory, including when working in a git worktree.
Read the applicable `AGENTS.md` before changing files.

Use the tools available in this Codex session. If it cannot spawn subagents,
say so before starting: the guarantee this workflow rests on is that every
step runs in a context that never held the previous step. Running the steps
yourself in one context is a different workflow, not this one. Parallel
planning is an optimization — degrade to sequential planning if needed; never
degrade the sequential implement→review→merge cycle into parallel work.

Ask focused questions only for the three blocking gates (batch confirmation,
plan approval, merge authorization) and for questions raised by planning
subagents; preserve answers and authorization already supplied by the user.

End with the next step, as described in the workflow. Use the next step's
`$skill-name` invocation when giving a Codex handoff.
