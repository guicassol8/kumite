import { z } from 'zod'

// What the client volunteers about where the bug happened (#145). Every field
// is optional and only length-capped on purpose: the route is public and the
// values are unverified, so an odd context must never be why a real report is
// rejected. The email labels the whole block as client-supplied.
export const BugReportContextSchema = z.object({
  route: z.string().max(500).optional(),
  userAgent: z.string().max(500).optional(),
  userEmail: z.string().max(320).optional(),
  userId: z.string().max(100).optional(),
  occurredAt: z.string().max(100).optional(),
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
