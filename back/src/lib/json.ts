import { z } from 'zod'

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
)

/**
 * Serializes a JSON value with every object's keys sorted, recursively, so
 * that two values Postgres considers the same `jsonb` produce the same
 * string. `JSON.stringify` preserves insertion order, so `{a:1,b:2}` and
 * `{b:2,a:1}` — indistinguishable once stored — would otherwise compare as
 * different.
 *
 * Array order stays significant: a reordered array is a different value.
 * `problems.service.ts#testCasesEqual` relies on that, because reordering a
 * problem's test cases changes the positional `index` of every
 * `case_results` entry already written (db/schema.ts).
 */
export function canonicalJson(value: JsonValue): string {
  return JSON.stringify(canonicalize(value))
}

function canonicalize(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value === null || typeof value !== 'object') return value

  const sorted: { [key: string]: JsonValue } = {}
  for (const key of Object.keys(value).sort()) {
    sorted[key] = canonicalize(value[key] as JsonValue)
  }
  return sorted
}
