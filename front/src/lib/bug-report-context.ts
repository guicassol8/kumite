import {
  BUG_REPORT_CONTEXT_EMAIL_MAX,
  BUG_REPORT_CONTEXT_ID_MAX,
  BUG_REPORT_CONTEXT_TEXT_MAX,
} from './field-limits'

export type BugReportContext = {
  route: string
  userAgent: string
  occurredAt: string
  userEmail?: string
  userId?: string
}

/**
 * The context block the bug report attaches automatically (#145), with every
 * field trimmed to the ceiling the API accepts (#194).
 *
 * The trimming is the whole point of this module. `navigator.userAgent` is not
 * something the reporter wrote or can see, and the browsers that ship the
 * longest ones (Chrome on Android, and anything behind a corporate proxy that
 * appends to it) run past the API's 500 characters — so the report came back a
 * 422 about a field that is not on the form, and no amount of rewriting the
 * description could get it through. Cutting it here keeps the schema's own
 * promise: an odd context must never be why a real report is rejected.
 *
 * A plain `slice`, with no ellipsis: this is machine-read text, and a marker
 * would only spend characters that could still carry the browser's version.
 * The API keeps refusing an over-long context — this is a client that stops
 * sending one, not a server that stopped caring.
 *
 * Pure, and in `lib/` rather than inline in the dialog's `onSubmit`, so the
 * ceilings are testable without stubbing `navigator`.
 */
export function buildBugReportContext({
  route,
  userAgent,
  occurredAt,
  user,
}: {
  route: string
  userAgent: string
  occurredAt: string
  user?: { id: string; email: string } | null
}): BugReportContext {
  return {
    route: route.slice(0, BUG_REPORT_CONTEXT_TEXT_MAX),
    userAgent: userAgent.slice(0, BUG_REPORT_CONTEXT_TEXT_MAX),
    occurredAt,
    ...(user
      ? {
          userEmail: user.email.slice(0, BUG_REPORT_CONTEXT_EMAIL_MAX),
          userId: user.id.slice(0, BUG_REPORT_CONTEXT_ID_MAX),
        }
      : {}),
  }
}
