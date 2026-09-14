# Creating tasks

Turn an idea into one or more GitHub Issues that a fresh agent session can pick
up with zero extra context. Conventions (labels, body format, ready-work rules)
live in `docs/workflow.md` — follow them exactly.

**Not for:** choosing what to do next (picking the next task), designing the
implementation (planning a task).

## Step 1 — Interrogate the user (MANDATORY)

Never create an issue from assumptions. Ask the user directly — batched, with
concrete options and a recommendation — and wait for a reply before
proceeding, until you can answer ALL of:

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

Compose each body exactly in the format from `docs/workflow.md` (Contexto /
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

The next step runs in a **fresh session**, so state cannot carry over in your
head — the very last thing you print is a plain, ready-to-open line for that
session.

One issue created, and it is the thing to do now:

```
Next: plan issue #12.
```

A backlog or an epic (several issues, no obvious next one):

```
Next: pick the next task.
```

Always substitute the real number. Never end with a prose suggestion alone —
end with the literal handoff line.
