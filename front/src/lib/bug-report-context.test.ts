import { describe, expect, it } from 'vitest'

import { buildBugReportContext } from './bug-report-context'
import {
  BUG_REPORT_CONTEXT_EMAIL_MAX,
  BUG_REPORT_CONTEXT_ID_MAX,
  BUG_REPORT_CONTEXT_TEXT_MAX,
} from './field-limits'

const occurredAt = '2026-09-19T12:00:00.000Z'

describe('buildBugReportContext', () => {
  it('cuts a user agent over the ceiling, keeping its beginning', () => {
    const userAgent = 'A'.repeat(700)
    const context = buildBugReportContext({ route: '/problem/42', userAgent, occurredAt })

    expect(context.userAgent).toHaveLength(BUG_REPORT_CONTEXT_TEXT_MAX)
    // The prefix, not an arbitrary window: the browser and its version sit at
    // the front of every user agent string, and that is the half worth keeping.
    expect(userAgent.startsWith(context.userAgent)).toBe(true)
  })

  it('leaves a user agent under the ceiling untouched', () => {
    const userAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
    expect(buildBugReportContext({ route: '/', userAgent, occurredAt }).userAgent).toBe(userAgent)
  })

  it('cuts a route over the ceiling too', () => {
    const route = `/problem/${'x'.repeat(700)}`
    expect(buildBugReportContext({ route, userAgent: 'ua', occurredAt }).route).toHaveLength(
      BUG_REPORT_CONTEXT_TEXT_MAX,
    )
  })

  it('omits the identity fields entirely when nobody is signed in', () => {
    const context = buildBugReportContext({ route: '/login', userAgent: 'ua', occurredAt })

    expect(context.userEmail).toBeUndefined()
    expect(context.userId).toBeUndefined()
    // Omitted, not empty: the API's schema makes both optional, and an empty
    // string would read as a blank sender in the notification email.
    expect('userEmail' in context).toBe(false)
  })

  it('carries the signed-in identity, each field within its own ceiling', () => {
    const context = buildBugReportContext({
      route: '/',
      userAgent: 'ua',
      occurredAt,
      user: { id: 'i'.repeat(200), email: `${'e'.repeat(400)}@example.com` },
    })

    expect(context.userEmail).toHaveLength(BUG_REPORT_CONTEXT_EMAIL_MAX)
    expect(context.userId).toHaveLength(BUG_REPORT_CONTEXT_ID_MAX)
  })

  it('passes the timestamp through as given', () => {
    expect(buildBugReportContext({ route: '/', userAgent: 'ua', occurredAt }).occurredAt).toBe(
      occurredAt,
    )
  })
})
