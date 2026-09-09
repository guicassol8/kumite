import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BUG_REPORT_COOLDOWN_MS } from '../../config'

const sendBugReportNotice = vi.fn().mockResolvedValue(undefined)

vi.mock('../notifications/notifications.service', () => ({
  sendBugReportNotice: (...args: unknown[]) => sendBugReportNotice(...args),
}))

import {
  acquireBugReportSlot,
  releaseBugReportSlot,
  resetBugReportThrottle,
  submitBugReport,
} from './bug-reports.service'

const report = { description: 'o botão de enviar não responde' }

describe('bug-reports.service throttle (#145)', () => {
  beforeEach(() => {
    resetBugReportThrottle()
  })

  it('grants the first report from an IP', () => {
    expect(acquireBugReportSlot('203.0.113.7', 1000)).toBe(true)
  })

  it('refuses a second report from the same IP inside the window', () => {
    acquireBugReportSlot('203.0.113.7', 1000)

    expect(acquireBugReportSlot('203.0.113.7', 1000 + BUG_REPORT_COOLDOWN_MS - 1)).toBe(false)
  })

  it('grants again once the window has passed', () => {
    acquireBugReportSlot('203.0.113.7', 1000)

    expect(acquireBugReportSlot('203.0.113.7', 1000 + BUG_REPORT_COOLDOWN_MS)).toBe(true)
  })

  it('keeps one IP from throttling another', () => {
    acquireBugReportSlot('203.0.113.7', 1000)

    expect(acquireBugReportSlot('198.51.100.4', 1000)).toBe(true)
  })

  it('hands the window back on release', () => {
    acquireBugReportSlot('203.0.113.7', 1000)
    releaseBugReportSlot('203.0.113.7')

    expect(acquireBugReportSlot('203.0.113.7', 1000)).toBe(true)
  })
})

describe('bug-reports.service submitBugReport (#145)', () => {
  beforeEach(() => {
    resetBugReportThrottle()
    sendBugReportNotice.mockClear()
    sendBugReportNotice.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sends the report, tagged with the IP the throttle counted it against', async () => {
    const result = await submitBugReport(report, '203.0.113.7', 1000)

    expect(result).toEqual({ ok: true })
    expect(sendBugReportNotice).toHaveBeenCalledWith({ ...report, ip: '203.0.113.7' })
  })

  it('throttles a second report from the same IP without sending anything', async () => {
    await submitBugReport(report, '203.0.113.7', 1000)
    sendBugReportNotice.mockClear()

    const result = await submitBugReport(report, '203.0.113.7', 1500)

    expect(result).toEqual({ ok: false, error: 'throttled' })
    expect(sendBugReportNotice).not.toHaveBeenCalled()
  })

  it('accepts the same IP again after the cooldown', async () => {
    await submitBugReport(report, '203.0.113.7', 1000)

    const result = await submitBugReport(report, '203.0.113.7', 1000 + BUG_REPORT_COOLDOWN_MS)

    expect(result).toEqual({ ok: true })
  })

  it('reports a failed send instead of pretending the report was filed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    sendBugReportNotice.mockRejectedValue(new Error('SES is down'))

    const result = await submitBugReport(report, '203.0.113.7', 1000)

    expect(result).toEqual({ ok: false, error: 'send_failed' })
    expect(console.error).toHaveBeenCalled()
  })

  // A failure the participant can see is a failure they will retry — charging
  // them a 60s cooldown for the server's outage would be the wrong lesson.
  it('does not spend the cooldown when the send failed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    sendBugReportNotice.mockRejectedValue(new Error('SES is down'))
    await submitBugReport(report, '203.0.113.7', 1000)

    sendBugReportNotice.mockResolvedValue(undefined)
    const result = await submitBugReport(report, '203.0.113.7', 1001)

    expect(result).toEqual({ ok: true })
  })
})
