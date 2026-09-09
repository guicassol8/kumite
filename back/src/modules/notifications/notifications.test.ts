import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockSend = vi.fn().mockResolvedValue({})

type EmailPart = { Data?: string; Charset?: string }
type SentMessage = {
  Subject: EmailPart
  Body: { Text?: EmailPart; Html?: EmailPart }
}

vi.mock('@aws-sdk/client-ses', () => ({
  SESClient: class {
    send = mockSend
  },
  SendEmailCommand: class {
    input: unknown
    constructor(input: unknown) {
      this.input = input
    }
  },
}))

describe('notifications.service renderPasswordResetEmail (#162)', () => {
  const baseUrl = 'https://kumite.ligadealgoritmos.com'

  it('puts the code, the 15-minute validity and one absolute link in the HTML part', async () => {
    const { renderPasswordResetEmail } = await import('./notifications.service')

    const { html } = renderPasswordResetEmail({ otp: '482917', baseUrl })

    expect(html).toContain('482917')
    expect(html).toContain('15 minutos')
    expect(html).toContain('https://kumite.ligadealgoritmos.com/reset-password')
    expect(html).not.toContain('//reset-password')
    // No relative path left anywhere: every occurrence carries the host.
    expect(html.replaceAll('https://kumite.ligadealgoritmos.com/reset-password', '')).not.toContain(
      '/reset-password',
    )
  })

  it('keeps the code copyable — contiguous digits, spacing from letter-spacing', async () => {
    const { renderPasswordResetEmail } = await import('./notifications.service')

    const { html } = renderPasswordResetEmail({ otp: '482917', baseUrl })

    expect(html).toContain('>482917<')
    expect(html).toContain('letter-spacing')
  })

  it('embeds no external image — clients block them by default', async () => {
    const { renderPasswordResetEmail } = await import('./notifications.service')

    const { html } = renderPasswordResetEmail({ otp: '482917', baseUrl })

    expect(html).not.toMatch(/<img\b/i)
  })

  it('repeats code, link and validity in the plain-text fallback', async () => {
    const { renderPasswordResetEmail } = await import('./notifications.service')

    const { text } = renderPasswordResetEmail({ otp: '482917', baseUrl })

    expect(text).toContain('482917')
    expect(text).toContain('15 minutos')
    expect(text).toContain('https://kumite.ligadealgoritmos.com/reset-password')
    // The unclickable relative instruction this issue exists to kill.
    expect(text).not.toContain('Acesse /reset-password')
  })

  it('builds the same link whether or not baseUrl carries a trailing slash', async () => {
    const { renderPasswordResetEmail } = await import('./notifications.service')

    const withSlash = renderPasswordResetEmail({ otp: '482917', baseUrl: `${baseUrl}/` })
    const withoutSlash = renderPasswordResetEmail({ otp: '482917', baseUrl })

    expect(withSlash.html).toBe(withoutSlash.html)
    expect(withSlash.text).toBe(withoutSlash.text)
  })
})

describe('notifications.service sendPasswordResetNotice (no SES config)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('falls back to console.log when SES_* env vars are unset', async () => {
    const { sendPasswordResetNotice } = await import('./notifications.service')

    await sendPasswordResetNotice({ email: 'ada@example.com', otp: '123456' })

    expect(console.log).toHaveBeenCalledOnce()
    expect(mockSend).not.toHaveBeenCalled()
    const [line] = vi.mocked(console.log).mock.calls[0] ?? []
    expect(line).toContain('ada@example.com')
    expect(line).toContain('123456')
  })

  // The credential-less path is what keeps local dev and CI's hurl job green
  // with no AWS secret at all — the richer body must not have started a send.
  it('still sends nothing through SES when the credentials are missing', async () => {
    const { sendPasswordResetNotice } = await import('./notifications.service')

    await sendPasswordResetNotice({ email: 'ada@example.com', otp: '123456' })

    expect(mockSend).not.toHaveBeenCalled()
    expect(console.log).toHaveBeenCalledOnce()
  })
})

describe('notifications.service sendPasswordResetNotice (SES configured)', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    mockSend.mockClear()
    vi.resetModules()
    // Reassigning process.env (in afterEach) severs Node's native binding, so
    // config.ts's loadEnvFile() no longer refills these from back/.env on a
    // second import — every case has to carry the required vars itself.
    process.env.JWT_SECRET = 'test-secret'
    process.env.DATABASE_URL = 'postgres://kumite:kumite@localhost:5433/kumite'
    process.env.SES_REGION = 'us-east-1'
    process.env.SES_ACCESS_KEY_ID = 'test-key'
    process.env.SES_SECRET_ACCESS_KEY = 'test-secret'
    process.env.SES_FROM_EMAIL = 'Kumite <noreply@example.com>'
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.resetModules()
  })

  it('sends via SES when SES_* config is present', async () => {
    const { sendPasswordResetNotice } = await import('./notifications.service')

    await sendPasswordResetNotice({ email: 'ada@example.com', otp: '654321' })

    expect(mockSend).toHaveBeenCalledOnce()
    const [command] = mockSend.mock.calls[0] ?? []
    const input = (command as { input: Record<string, unknown> }).input
    expect(input.Source).toBe('Kumite <noreply@example.com>')
    expect(input).toMatchObject({
      Destination: { ToAddresses: ['ada@example.com'] },
    })
    expect(JSON.stringify(input)).toContain('654321')
  })

  it('carries both an HTML and a text body, all parts declared UTF-8 (#162)', async () => {
    process.env.APP_BASE_URL = 'https://kumite.ligadealgoritmos.com'
    const { sendPasswordResetNotice } = await import('./notifications.service')

    await sendPasswordResetNotice({ email: 'ada@example.com', otp: '654321' })

    const [command] = mockSend.mock.calls[0] ?? []
    const { Message } = (command as { input: { Message: SentMessage } }).input

    expect(Message.Subject.Data).toBe('Código de redefinição de senha — Kumite')
    expect(Message.Subject.Charset).toBe('UTF-8')

    expect(Message.Body.Html?.Data).toContain('654321')
    expect(Message.Body.Html?.Data).toContain('https://kumite.ligadealgoritmos.com/reset-password')
    expect(Message.Body.Html?.Charset).toBe('UTF-8')

    expect(Message.Body.Text?.Data).toContain('654321')
    expect(Message.Body.Text?.Data).toContain('https://kumite.ligadealgoritmos.com/reset-password')
    expect(Message.Body.Text?.Charset).toBe('UTF-8')
  })
})
