# CLAUDE.md

See @AGENTS.md for the canonical instructions.

## Clarification

Reuse the user's prior answers and authorization. Ask focused questions
(AskUserQuestion, batched, with options where useful) for missing product
decisions or constraints that materially affect the task. Resolve routine
implementation details from repository conventions and code evidence; state
material assumptions. A complete request does not need another question round.

## Skills

These are Claude Code's slash-command shortcut over the agent-agnostic
process in `docs/task-workflow/` (see `AGENTS.md` § Map) — use them when
running inside Claude Code; the docs are the source of truth.

| Skill | Use when |
|---|---|
| creating-tasks | turning ideas/specs into GitHub Issues |
| picking-next-task | choosing what to work on next |
| planning-tasks | designing the implementation of an issue |
| implementing-tasks | coding an approved plan |
| reviewing-tasks | reviewing a PR + producing mandatory evidence |
| orchestrating-batch | running 2–3 issues end to end via subagents |

Each step is its own chat: every skill ends by printing the next step's command,
ready to paste into a new session. The full chain is in `docs/workflow.md`
§ One step, one session.

`orchestrating-batch` is the deliberate exception: it runs the whole chain in
one chat, delegating planning, implementation and review to a fresh-context
subagent each instead of to a new chat. Same isolation, different boundary —
`docs/workflow.md` § One step, one session.

## Claude-specific notes

- The `kata-docs` MCP server (`.mcp.json`) is optional — it may be disabled
  in `settings.local.json`. When it is available, prefer it for kata API
  questions; when it is not, read `~/Projetos/kata/docs` and the bundled
  `.d.ts` directly, and do not report its absence.
- Kata feedback: a report in `kata-feedback/` only when kata was genuinely
  in frame or caused friction; otherwise one line in `kata-feedback/LEDGER.csv`.
  See `AGENTS.md` § Kata framework feedback. Never fix kata itself as a side
  effect of a kumite task.
- Hooks: PostToolUse auto-formats and runs `kata verify` on back edits; Stop
  runs the full gate ladder (typecheck → verify → tests) and blocks until
  green. The pre-commit (lefthook) runs format, typecheck and verify only —
  the test suites run once, in the Stop hook and in CI (#288).
- Worktrees: prefer the harness's own isolation — `EnterWorktree` for this
  session's task work, `isolation: "worktree"` when spawning subagents that
  edit files. Manual fallback:
  `git worktree add .worktrees/task-<N>-<slug> -b task/<N>-<slug> develop`
  then `pnpm install` inside it (node_modules are not shared).
