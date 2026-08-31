import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./session', () => ({
  authHeader: vi.fn(),
  clearSession: vi.fn(),
}))

import { api } from './api'
import { authHeader, clearSession } from './session'

const mockedAuthHeader = vi.mocked(authHeader)
const mockedClearSession = vi.mocked(clearSession)

beforeEach(() => {
  mockedAuthHeader.mockReset()
  mockedClearSession.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('api authFetch', () => {
  it('clears the session as expired on a 401 that carried an Authorization header', async () => {
    mockedAuthHeader.mockReturnValue({ Authorization: 'Bearer tok' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })))

    await api.health.$get()

    expect(mockedClearSession).toHaveBeenCalledWith('expired')
  })

  it('does not clear the session on a 401 without an Authorization header', async () => {
    mockedAuthHeader.mockReturnValue({})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })))

    await api.health.$get()

    expect(mockedClearSession).not.toHaveBeenCalled()
  })

  it('does not clear the session on a non-401 response, even with an Authorization header', async () => {
    mockedAuthHeader.mockReturnValue({ Authorization: 'Bearer tok' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })))

    await api.health.$get()

    expect(mockedClearSession).not.toHaveBeenCalled()
  })
})
