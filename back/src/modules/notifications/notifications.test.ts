import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockSend = vi.fn().mockResolvedValue({})

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

describe('notifications.service sendPasswordResetNotice (no AWS config)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('falls back to console.log when AWS_* env vars are unset', async () => {
    const { sendPasswordResetNotice } = await import('./notifications.service')

    await sendPasswordResetNotice({ email: 'ada@example.com', otp: '123456' })

    expect(console.log).toHaveBeenCalledOnce()
    expect(mockSend).not.toHaveBeenCalled()
    const [line] = vi.mocked(console.log).mock.calls[0] ?? []
    expect(line).toContain('ada@example.com')
    expect(line).toContain('123456')
  })
})

describe('notifications.service sendPasswordResetNotice (AWS configured)', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    mockSend.mockClear()
    vi.resetModules()
    process.env.AWS_REGION = 'us-east-1'
    process.env.AWS_ACCESS_KEY_ID = 'test-key'
    process.env.AWS_SECRET_ACCESS_KEY = 'test-secret'
    process.env.SES_FROM_EMAIL = 'Kumite <noreply@example.com>'
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.resetModules()
  })

  it('sends via SES when AWS_* config is present', async () => {
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
})
