import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { sendPasswordResetNotice } from './notifications.service'

describe('notifications.service sendPasswordResetNotice', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs the email and temporary password once', async () => {
    await sendPasswordResetNotice({ email: 'ada@example.com', temporaryPassword: 'temp-pass-123' })

    expect(console.log).toHaveBeenCalledOnce()
    const [line] = vi.mocked(console.log).mock.calls[0] ?? []
    expect(line).toContain('ada@example.com')
    expect(line).toContain('temp-pass-123')
  })
})
