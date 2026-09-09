import type { z } from 'zod'

type ParseEnvOptions = {
  /** What the message calls the environment being validated, e.g. `back/ environment`. */
  subject: string
  /** Closing line telling the reader where the full list of values lives. */
  hint: string
}

/**
 * Validates `source` against `schema`, aborting with a message a human can act
 * on instead of a raw `ZodError` (#97).
 *
 * `EnvSchema.parse(process.env)` runs at import time, so a missing variable
 * surfaces once per test file that transitively imports `config.ts` — nine
 * unrelated-looking ZodError dumps in the PR #92 review, none of which said
 * which variable was missing. Here every offending variable is collected into a
 * single line-per-variable message, and the thrown error's stack is replaced by
 * that message: the frame pointing back at `config.ts` explains nothing and
 * only buries the line that does.
 *
 * The received value is never echoed — `DATABASE_URL` and `JWT_SECRET` are
 * secrets, and a malformed one carries a password into CI's stdout.
 */
export function parseEnv<Schema extends z.ZodTypeAny>(
  schema: Schema,
  source: NodeJS.ProcessEnv,
  options: ParseEnvOptions,
): z.infer<Schema> {
  const result = schema.safeParse(source)
  if (result.success) return result.data

  // One bullet per variable, first issue wins: zod happily reports two
  // failures for the same key (too short *and* wrong suffix) and repeating
  // the name would misrepresent how much is actually broken.
  const reasonByVariable = new Map<string, string>()
  for (const issue of result.error.issues) {
    const variable = issue.path.join('.') || '(root)'
    if (reasonByVariable.has(variable)) continue
    reasonByVariable.set(variable, describe(issue))
  }

  const count = reasonByVariable.size
  const noun = count === 1 ? 'variable' : 'variables'
  const lines = [
    `Invalid ${options.subject} — ${count} ${noun} missing or invalid:`,
    ...[...reasonByVariable].map(([variable, reason]) => `  - ${variable}: ${reason}`),
    options.hint,
  ]

  const error = new Error(lines.join('\n'))
  error.stack = error.message
  throw error
}

function describe(issue: z.ZodIssue): string {
  if (issue.code === 'invalid_type' && issue.received === 'undefined') {
    return 'required, but not set'
  }
  return issue.message
}
