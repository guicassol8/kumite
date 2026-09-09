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

  // This path is what keeps local dev and CI's hurl job green with no AWS
  // secret at all — the richer HTML body (#162) must not have started a send.
  it('falls back to console.log when SES_* env vars are unset', async () => {
    const { sendPasswordResetNotice } = await import('./notifications.service')

    await sendPasswordResetNotice({ email: 'ada@example.com', otp: '123456' })

    expect(console.log).toHaveBeenCalledOnce()
    expect(mockSend).not.toHaveBeenCalled()
    const [line] = vi.mocked(console.log).mock.calls[0] ?? []
    expect(line).toContain('ada@example.com')
    expect(line).toContain('123456')
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

describe('notifications.service renderBugReportEmail (#145)', () => {
  // An earlier describe reassigns process.env, which severs Node's native
  // binding — config.ts's loadEnvFile() no longer refills JWT_SECRET from
  // back/.env on the next import, so every describe past that point has to
  // carry the required vars itself.
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret'
    process.env.DATABASE_URL = 'postgres://kumite:kumite@localhost:5433/kumite'
  })

  const baseUrl = 'https://kumite.ligadealgoritmos.com'
  const notice = {
    description: 'O botão de enviar não responde na terceira questão',
    replyTo: 'ada@example.com',
    ip: '203.0.113.7',
    context: {
      route: '/problem/42',
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
      userEmail: 'ada@example.com',
      userId: 'user-1',
      occurredAt: '2026-09-09T18:00:00.000Z',
    },
  }

  it('carries the description and every context field in the HTML part', async () => {
    const { renderBugReportEmail } = await import('./notifications.service')

    const { html } = renderBugReportEmail({ notice, baseUrl })

    expect(html).toContain('O botão de enviar não responde na terceira questão')
    expect(html).toContain('/problem/42')
    expect(html).toContain('Mozilla/5.0 (X11; Linux x86_64)')
    expect(html).toContain('ada@example.com')
    expect(html).toContain('user-1')
    expect(html).toContain('2026-09-09T18:00:00.000Z')
    expect(html).toContain('203.0.113.7')
  })

  it('labels the context as client-supplied and unverified — the route is public', async () => {
    const { renderBugReportEmail } = await import('./notifications.service')

    const { html, text } = renderBugReportEmail({ notice, baseUrl })

    expect(html).toContain('não verificado')
    expect(text).toContain('não verificado')
  })

  it('turns a relative route into one absolute link, with no doubled slash', async () => {
    const { renderBugReportEmail } = await import('./notifications.service')

    const { html, text } = renderBugReportEmail({ notice, baseUrl })

    expect(html).toContain('href="https://kumite.ligadealgoritmos.com/problem/42"')
    expect(html).not.toContain('.com//problem')
    expect(text).toContain('https://kumite.ligadealgoritmos.com/problem/42')
  })

  it('never turns a non-relative "route" into an href', async () => {
    const { renderBugReportEmail } = await import('./notifications.service')

    const evil = { ...notice, context: { route: 'javascript:alert(1)' } }
    const external = { ...notice, context: { route: 'https://phishing.example.com' } }

    const { html: evilHtml } = renderBugReportEmail({ notice: evil, baseUrl })
    const { html: externalHtml } = renderBugReportEmail({ notice: external, baseUrl })

    expect(evilHtml).not.toContain('href="javascript:')
    expect(externalHtml).not.toContain('href="https://phishing.example.com"')
    // Still reported, just as inert text.
    expect(evilHtml).toContain('javascript:alert(1)')
    expect(externalHtml).toContain('https://phishing.example.com')
  })

  it('escapes client text instead of letting it inject markup', async () => {
    const { renderBugReportEmail } = await import('./notifications.service')

    const injected = {
      ...notice,
      description: '<script>alert(1)</script> & "quebrado"',
      context: { userAgent: '<img src=x onerror=alert(1)>' },
    }

    const { html } = renderBugReportEmail({ notice: injected, baseUrl })

    expect(html).not.toContain('<script>')
    expect(html).not.toMatch(/<img\b/i)
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&amp;')
  })

  it('embeds no external image — clients block them by default', async () => {
    const { renderBugReportEmail } = await import('./notifications.service')

    const { html } = renderBugReportEmail({ notice, baseUrl })

    expect(html).not.toMatch(/<img\b/i)
  })

  it('repeats the description and the context in the plain-text fallback', async () => {
    const { renderBugReportEmail } = await import('./notifications.service')

    const { text } = renderBugReportEmail({ notice, baseUrl })

    expect(text).toContain('O botão de enviar não responde na terceira questão')
    expect(text).toContain('/problem/42')
    expect(text).toContain('Mozilla/5.0 (X11; Linux x86_64)')
    expect(text).toContain('ada@example.com')
  })

  it('renders a report with no context at all', async () => {
    const { renderBugReportEmail } = await import('./notifications.service')

    const { html, text } = renderBugReportEmail({
      notice: { description: 'quebrou tudo' },
      baseUrl,
    })

    expect(html).toContain('quebrou tudo')
    expect(text).toContain('quebrou tudo')
  })
})

describe('notifications.service sendBugReportNotice (no SES config)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    // Shared across the whole file — an earlier SES-configured case has
    // already used it, so "never sent" only means anything after a clear.
    mockSend.mockClear()
    vi.resetModules()
    process.env.JWT_SECRET = 'test-secret'
    process.env.DATABASE_URL = 'postgres://kumite:kumite@localhost:5433/kumite'
    // vitest.setup.ts blanks these once, but the SES-configured describes
    // above reassign process.env — restate the fallback condition here.
    process.env.SES_REGION = ''
    process.env.SES_ACCESS_KEY_ID = ''
    process.env.SES_SECRET_ACCESS_KEY = ''
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('falls back to console.log when SES_* env vars are unset', async () => {
    const { sendBugReportNotice } = await import('./notifications.service')

    await sendBugReportNotice({ description: 'o editor travou', replyTo: 'ada@example.com' })

    expect(console.log).toHaveBeenCalledOnce()
    expect(mockSend).not.toHaveBeenCalled()
    const [line] = vi.mocked(console.log).mock.calls[0] ?? []
    expect(line).toContain('o editor travou')
  })

  it('rejects a report the schema refuses instead of sending garbage', async () => {
    const { sendBugReportNotice } = await import('./notifications.service')

    await expect(sendBugReportNotice({ description: '' })).rejects.toThrow()
  })
})

describe('notifications.service sendBugReportNotice (SES configured)', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    mockSend.mockClear()
    vi.resetModules()
    process.env.JWT_SECRET = 'test-secret'
    process.env.DATABASE_URL = 'postgres://kumite:kumite@localhost:5433/kumite'
    process.env.SES_REGION = 'us-east-1'
    process.env.SES_ACCESS_KEY_ID = 'test-key'
    process.env.SES_SECRET_ACCESS_KEY = 'test-secret'
    process.env.SES_FROM_EMAIL = 'Kumite <noreply@example.com>'
    process.env.BUG_REPORT_TO_EMAIL = 'bugs@example.com'
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.resetModules()
  })

  it('sends to BUG_REPORT_TO_EMAIL with both bodies, all parts UTF-8', async () => {
    const { sendBugReportNotice } = await import('./notifications.service')

    await sendBugReportNotice({ description: 'não consigo submeter' })

    expect(mockSend).toHaveBeenCalledOnce()
    const [command] = mockSend.mock.calls[0] ?? []
    const input = (command as { input: { Message: SentMessage } & Record<string, unknown> }).input

    expect(input.Source).toBe('Kumite <noreply@example.com>')
    expect(input).toMatchObject({ Destination: { ToAddresses: ['bugs@example.com'] } })

    const { Message } = input
    expect(Message.Subject.Data).toBe('Bug report — Kumite')
    expect(Message.Subject.Charset).toBe('UTF-8')
    expect(Message.Body.Html?.Data).toContain('não consigo submeter')
    expect(Message.Body.Html?.Charset).toBe('UTF-8')
    expect(Message.Body.Text?.Data).toContain('não consigo submeter')
    expect(Message.Body.Text?.Charset).toBe('UTF-8')
  })

  it('sets Reply-To when the reporter left an address', async () => {
    const { sendBugReportNotice } = await import('./notifications.service')

    await sendBugReportNotice({ description: 'trava no login', replyTo: 'ada@example.com' })

    const [command] = mockSend.mock.calls[0] ?? []
    const input = (command as { input: Record<string, unknown> }).input

    expect(input.ReplyToAddresses).toEqual(['ada@example.com'])
  })

  it('omits Reply-To entirely for an anonymous report', async () => {
    const { sendBugReportNotice } = await import('./notifications.service')

    await sendBugReportNotice({ description: 'trava no login' })

    const [command] = mockSend.mock.calls[0] ?? []
    const input = (command as { input: Record<string, unknown> }).input

    expect(input.ReplyToAddresses).toBeUndefined()
  })
})
