import { z } from 'zod'

// Ceilings on the context block, named so the front can mirror them (#194).
// They were literals until a 700-character `navigator.userAgent` — the kind
// Chrome on Android ships — made every report from that browser a 422 the
// person could do nothing about: the client now trims each field to these
// before sending. `front/src/lib/field-limits.ts` holds the copies (front may
// not import from back, and `.max()` does not change the inferred type, so
// `hc<AppType>` cannot carry them); both sides pin the literals in a test.
export const BUG_REPORT_CONTEXT_TEXT_MAX = 500
export const BUG_REPORT_CONTEXT_EMAIL_MAX = 320
export const BUG_REPORT_CONTEXT_ID_MAX = 100

// What the client volunteers about where the bug happened (#145). Every field
// is optional and only length-capped on purpose: the route is public and the
// values are unverified, so an odd context must never be why a real report is
// rejected. The email labels the whole block as client-supplied.
export const BugReportContextSchema = z.object({
  route: z.string().max(BUG_REPORT_CONTEXT_TEXT_MAX).optional(),
  userAgent: z.string().max(BUG_REPORT_CONTEXT_TEXT_MAX).optional(),
  userEmail: z.string().max(BUG_REPORT_CONTEXT_EMAIL_MAX).optional(),
  userId: z.string().max(BUG_REPORT_CONTEXT_ID_MAX).optional(),
  occurredAt: z.string().max(BUG_REPORT_CONTEXT_ID_MAX).optional(),
})

export const CreateBugReportBodySchema = z.object({
  // Trimmed before the length check: whitespace is not a report, and 2000
  // characters is what the front's counter shows.
  description: z.string().trim().min(1).max(2000),
  replyTo: z.string().email().optional(),
  context: BugReportContextSchema.optional(),
})

export type CreateBugReportBody = z.infer<typeof CreateBugReportBodySchema>

// Nothing is persisted (the Liga's inbox is the record), so there is no id to
// hand back — only the acknowledgement that the email left the process.
export const BugReportAcceptedSchema = z.object({
  ok: z.literal(true),
})
