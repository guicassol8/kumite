import { z } from 'zod'

// Single source of truth for **input** id fields — params, body and query.
// Every id kumite receives keys a Postgres `uuid` column, so a malformed value
// matches no row: without this the string reaches the driver and blows up as a
// generic 500 instead of stopping at the edge with kata's 422 envelope (#94).
//
// Output schemas (ProblemSchema, RoundSchema, TeamSchema, ...) deliberately
// stay on plain `z.string()`: those values are produced by the server, never
// received, so `.uuid()` there would be documentation with no 500 to prevent.
//
// Auditing new code is therefore a `grep UuidSchema` away — an id field in an
// input schema that isn't using this helper is the bug.
export const UuidSchema = z.string().uuid()
