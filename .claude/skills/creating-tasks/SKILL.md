---
name: creating-tasks
description: Turns a feature idea or spec into well-formed GitHub Issues with priority, stack and type labels, EARS acceptance criteria and explicit dependencies, interrogating the user first. Use when the user wants to create tasks, issues, epics or backlog items. Triggers: "cria task", "criar tasks", "nova task", "cria as issues", "monta o backlog", "abre uma issue", "create tasks", "new issue", "spec this out".
---

# Creating tasks

Turn an idea into one or more GitHub Issues that a fresh agent session can pick
up with zero extra context. Conventions (labels, body format, ready-work rules)
live in @docs/workflow.md — follow them exactly.

**Not for:** choosing what to do next (`picking-next-task`), designing the
implementation (`planning-tasks`).

## Step 1 — Interrogate the user (MANDATORY)

Never create an issue from assumptions. Ask the user with AskUserQuestion —
batched, with options and a recommendation — until you can answer ALL of:

1. **Goal** — what changes for a participant/organizer when this ships?
2. **Scope** — what is explicitly OUT of this task?
3. **Acceptance** — draft the EARS lines (`WHEN <condition> THE SYSTEM SHALL
   <behavior>`, including error paths) and have the user confirm or correct them.
4. **Priority** — P0..P4. Recommend one; the user decides. Default P2.
5. **Stack** — front / back / fullstack / infra / harness.
6. **Type** — feature / bug / chore / spike.
7. **Dependencies** — must something land first? Check `gh issue list --state open`
   for candidates and confirm with the user.
8. **Isolation** — which modules, routes, screens does it touch? Does that
   overlap open issues or in-progress work? If yes, record it.
9. **Size** — bigger than one focused session? Then it is an epic: split into
   sub-issues (each passing questions 1–8 on its own).

Two rounds of questions is normal; zero rounds is a bug. Only skip a question
when the user's request already answers it explicitly.

## Step 2 — Write the issues

Compose each body exactly in the format from @docs/workflow.md (Contexto /
Spec / Acceptance / Blocked by), then:

```bash
gh issue create \
  --title "<verb-first, concrete title>" \
  --label P2 --label stack:back --label type:feature \
  --body-file -
```

For an epic: create the epic first (`--label epic` + priority + stack), then
each sub-issue with `Part of #E` in Contexto, then edit the epic body to hold
the task list (`- [ ] #N` per sub-issue).

## Step 3 — Confirm

Show the user every created issue as `#N — title (labels)` with URLs. If
anything is off, fix with `gh issue edit` — don't leave a wrong issue behind.

## Step 4 — Handoff (MANDATORY)

The next step runs in a **fresh chat**, so the very last thing you print is the
command to paste there — alone in a fenced block, nothing after it.

One issue created, and it is the thing to do now:

```
/planning-tasks #12
```

A backlog or an epic (several issues, no obvious next one):

```
/picking-next-task
```

Always substitute the real number. Never end with "agora é só planejar" or a
prose suggestion — end with the command itself.
