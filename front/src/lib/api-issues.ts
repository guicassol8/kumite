/**
 * Reader for kata's automatic per-field validation envelope (#187).
 *
 * kata answers a failed input schema with
 * `{ error, message, issues }`, where `issues` is keyed by request *section* —
 * `params`, `query`, `body`, `headers` — and each section holds
 * `{ path, message, code, expected?, received? }`. `path` is always a string in
 * dot/bracket notation (`translations[0].title`), never an array, and the root
 * of a section comes through as `''`.
 */
export type ApiFieldIssue = {
  path: string
  message: string
  code?: string
}

type Envelope = {
  error?: unknown
  issues?: {
    body?: unknown
  }
}

function isFieldIssue(value: unknown): value is ApiFieldIssue {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.path === 'string' && typeof candidate.message === 'string'
}

/**
 * Pulls the body-section issues out of a response, or `[]` when there are none
 * to be had.
 *
 * Takes `unknown` rather than `Response` on purpose. The 422 is produced by
 * kata's validation middleware, framework-level and not configurable, so it
 * appears in no route's `output` map; `hc<AppType>` therefore narrows the error
 * branch to `never` and `res.status === 422` is a TS2367. Casting through
 * `unknown` once, here, is what keeps that cast out of every call site — there
 * were three hand-rolled copies of it before this module.
 *
 * Only `issues.body` is read, deliberately. `issues.params` is what turns a
 * malformed id into the screens' "not found" (see `lib/problems-query.ts`), and
 * promoting it to a field error would break that. Everything else degrades to
 * `[]`: a 500 with no envelope, a non-JSON body, a `json()` that rejects, and
 * kata's 400 for a malformed request body — which carries a single issue whose
 * `path` is `''` and belongs to no field.
 */
export async function readFieldIssues(res: unknown): Promise<ApiFieldIssue[]> {
  return fieldIssuesFrom(await readEnvelope(res))
}

/**
 * Parses a response body once, so a caller that needs both the error code and
 * the field issues can have them without reading the stream twice.
 *
 * `res.clone()` would be the obvious alternative, but the plain `{ json() }`
 * stubs the route tests use do not implement it.
 */
export async function readEnvelope(res: unknown): Promise<unknown> {
  return await (res as Response).json().catch(() => null)
}

/** The `fieldIssuesFrom` half of `readFieldIssues`, over an already-parsed body. */
export function fieldIssuesFrom(body: unknown): ApiFieldIssue[] {
  const issues = (body as Envelope | null)?.issues?.body
  if (!Array.isArray(issues)) return []
  return issues.filter(isFieldIssue).filter((issue) => issue.path !== '')
}

/**
 * The `error` code of kata's envelope — the machine-readable half that a screen
 * translates, as opposed to `message`, which is English prose written for the
 * API's own logs. `null` whenever the body is not an envelope with a string
 * code.
 */
export function errorCodeFrom(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null
  const code = (body as Envelope).error
  return typeof code === 'string' ? code : null
}
