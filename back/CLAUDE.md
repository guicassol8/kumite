# Claude Code Instructions

See @AGENTS.md for the canonical instructions (shared with Codex and other
agents).

Claude-specific notes:
- `.claude/settings.json` wires the harness hooks (PreToolUse / PostToolUse /
  Stop) and the config-tampering `permissions.deny` bans.
- PreToolUse / PostToolUse run `kata verify --json`; the PostToolUse hook
  injects remaining findings as `hookSpecificOutput.additionalContext` so the
  fix lands on the next turn.
- Stop runs `pnpm test` — a red suite blocks ending the session.
