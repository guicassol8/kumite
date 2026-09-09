import { ErrorBodySchema } from '@katajs-framework/core'

import { defineRoute } from '../../context'
import { clientIp } from '../../lib/client-ip'

import { BugReportAcceptedSchema, CreateBugReportBodySchema } from './bug-reports.schema'
import { submitBugReport } from './bug-reports.service'

// Public — no `use:` — like login/signup and the password-reset routes: the
// bug worth hearing about the most is the one that keeps someone from logging
// in. The per-IP cooldown in the service is what stands in for a session here.
//
// 422 is not declared: kata answers validation failures itself, before the
// handler runs (same reason 413/401 are absent in submissions.route.ts).
export const createBugReportRoute = defineRoute({
  method: 'POST',
  path: '/bug-reports',
  input: { body: CreateBugReportBodySchema },
  output: {
    200: BugReportAcceptedSchema,
    429: ErrorBodySchema,
    502: ErrorBodySchema,
  },
  handler: async (c) => {
    const result = await submitBugReport(c.input.body, clientIp(c.raw))

    if (result.ok) return c.json({ ok: true } as const, 200)

    if (result.error === 'throttled') {
      return c.error('bug_report_throttled', 'Wait before sending another report', { status: 429 })
    }

    // Nothing is stored, so a failed send means the report is simply gone —
    // saying so is what lets the front offer the Liga's address instead.
    return c.error('bug_report_send_failed', 'Could not deliver the report', { status: 502 })
  },
})
