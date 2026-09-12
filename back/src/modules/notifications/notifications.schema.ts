import { z } from 'zod'

import { LocaleSchema } from '../../lib/locale'

export const PasswordResetNoticeSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
  locale: LocaleSchema.optional(),
})

export type PasswordResetNotice = z.infer<typeof PasswordResetNoticeSchema>

// Everything the client volunteered about where the bug happened (#145).
// Every field is optional and only length-capped: this is unverified data
// from a public route, and a weird context must never be the reason a real
// report fails to reach the Liga.
export const BugReportContextSchema = z.object({
  route: z.string().max(500).optional(),
  userAgent: z.string().max(500).optional(),
  userEmail: z.string().max(320).optional(),
  userId: z.string().max(100).optional(),
  occurredAt: z.string().max(100).optional(),
})

export type BugReportContext = z.infer<typeof BugReportContextSchema>

export const BugReportNoticeSchema = z.object({
  description: z.string().min(1).max(2000),
  replyTo: z.string().email().optional(),
  // The address the throttle counted this report against — useful in the
  // inbox to spot a flood, and never shown to another participant.
  ip: z.string().max(100).optional(),
  context: BugReportContextSchema.optional(),
})

export type BugReportNotice = z.infer<typeof BugReportNoticeSchema>
