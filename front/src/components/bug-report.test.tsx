import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  api: {
    'bug-reports': { $post: vi.fn() },
    me: { $get: vi.fn() },
  },
  authFetch: vi.fn(),
}))

import i18n from '@/i18n'

import { api } from '@/lib/api'
import { clearSession, type SessionUser, setSession } from '@/lib/session'
import { routeTree } from '@/routeTree.gen'

const mockedPost = vi.mocked(api['bug-reports'].$post)

// biome-ignore lint/suspicious/noExplicitAny: minimal fetch Response stubs
function jsonResponse(status: number, body: unknown): any {
  return { status, json: async () => body }
}

const fakeUser: SessionUser = {
  id: 'u1',
  name: 'Ada Lovelace',
  email: 'ada@edu.pucrs.br',
  role: 'participant',
  university: 'pucrs',
  active: true,
  mustChangePassword: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
}

// The component is mounted by __root.tsx, so the whole router is what puts it
// on screen — which is also the assertion that it reaches every route.
function renderApp(initialEntry = '/login') {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

async function openDialog() {
  const trigger = await screen.findByTestId('bug-report-trigger')
  fireEvent.click(trigger)
  await screen.findByTestId('bug-report-dialog')
}

async function fillAndSubmit(description = 'o botão de enviar não responde') {
  fireEvent.change(screen.getByTestId('bug-report-description'), {
    target: { value: description },
  })
  fireEvent.click(screen.getByTestId('bug-report-submit'))
}

beforeEach(() => {
  clearSession('manual')
  mockedPost.mockReset()
  mockedPost.mockResolvedValue(jsonResponse(200, { ok: true }))
})

afterEach(async () => {
  cleanup()
  clearSession('manual')
  // i18n is a module singleton — a language switched in one case would leak
  // into every PT assertion after it.
  await i18n.changeLanguage('pt')
})

describe('BugReport', () => {
  it('shows the trigger on any route, anonymous included', async () => {
    renderApp('/')

    expect(await screen.findByTestId('bug-report-trigger')).toBeDefined()
  })

  it('opens with an empty description and an empty email when anonymous', async () => {
    renderApp()
    await openDialog()

    expect(screen.getByTestId<HTMLTextAreaElement>('bug-report-description').value).toBe('')
    expect(screen.getByTestId<HTMLInputElement>('bug-report-email').value).toBe('')
  })

  it("prefills the email with the session's address when authenticated", async () => {
    setSession(fakeUser, 'tok-1')
    renderApp()
    await openDialog()

    await waitFor(() =>
      expect(screen.getByTestId<HTMLInputElement>('bug-report-email').value).toBe(
        'ada@edu.pucrs.br',
      ),
    )
  })

  it('sends the description plus the automatic context and confirms', async () => {
    renderApp('/login')
    await openDialog()
    await fillAndSubmit()

    await waitFor(() => expect(mockedPost).toHaveBeenCalledOnce())
    const [payload] = mockedPost.mock.calls[0] ?? []
    const json = (payload as { json: Record<string, unknown> }).json
    expect(json.description).toBe('o botão de enviar não responde')

    const context = json.context as Record<string, string>
    expect(context.route).toBe('/login')
    expect(context.userAgent).toBe(navigator.userAgent)
    expect(context.occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)

    expect(await screen.findByText('Relato enviado')).toBeDefined()
  })

  it('carries the session identity in the context when authenticated', async () => {
    setSession(fakeUser, 'tok-1')
    renderApp()
    await openDialog()
    await fillAndSubmit()

    await waitFor(() => expect(mockedPost).toHaveBeenCalledOnce())
    const [payload] = mockedPost.mock.calls[0] ?? []
    const json = (payload as { json: Record<string, unknown> }).json
    const context = json.context as Record<string, string>

    expect(context.userEmail).toBe('ada@edu.pucrs.br')
    expect(context.userId).toBe('u1')
    expect(json.replyTo).toBe('ada@edu.pucrs.br')
  })

  it('omits replyTo entirely when the email field is left blank', async () => {
    renderApp()
    await openDialog()
    await fillAndSubmit()

    await waitFor(() => expect(mockedPost).toHaveBeenCalledOnce())
    const [payload] = mockedPost.mock.calls[0] ?? []
    const json = (payload as { json: Record<string, unknown> }).json

    expect(json.replyTo).toBeUndefined()
  })

  // `nao-e-um-email` is not tested here: the field is an `<input type="email">`,
  // so jsdom's own constraint validation swallows the submit before
  // react-hook-form ever sees it — exactly as a browser would (same note as
  // reset-password.test.tsx). `ada@pucrs` is the interesting case: the native
  // check accepts it and zod is what refuses it.
  it('refuses an address the native check lets through, without calling the API', async () => {
    renderApp()
    await openDialog()
    fireEvent.change(screen.getByTestId('bug-report-email'), {
      target: { value: 'ada@pucrs' },
    })
    await fillAndSubmit()

    expect(
      await screen.findByText('Digite um e-mail válido ou deixe o campo em branco.'),
    ).toBeDefined()
    expect(mockedPost).not.toHaveBeenCalled()
    expect(screen.getByTestId('bug-report-dialog')).toBeDefined()
  })

  it('refuses an empty description, without calling the API', async () => {
    renderApp()
    await openDialog()
    fireEvent.click(screen.getByTestId('bug-report-submit'))

    expect(await screen.findByText('Escreva o que aconteceu.')).toBeDefined()
    expect(mockedPost).not.toHaveBeenCalled()
  })

  it('asks the user to wait on 429, keeping the dialog and the typed text', async () => {
    mockedPost.mockResolvedValue(jsonResponse(429, { error: 'bug_report_throttled' }))
    renderApp()
    await openDialog()
    await fillAndSubmit()

    const error = await screen.findByTestId('bug-report-error')
    expect(error.textContent).toContain('Aguarde um minuto')
    expect(error.textContent).toContain('ligadealgoritmos@gmail.com')
    expect(screen.getByTestId<HTMLTextAreaElement>('bug-report-description').value).toBe(
      'o botão de enviar não responde',
    )
  })

  it('reports a validation refusal from the API (422) without closing the dialog', async () => {
    mockedPost.mockResolvedValue(jsonResponse(422, { error: 'validation_failed' }))
    renderApp()
    await openDialog()
    await fillAndSubmit()

    const error = await screen.findByTestId('bug-report-error')
    expect(error.textContent).toContain('confira a descrição')
    expect(screen.getByTestId('bug-report-dialog')).toBeDefined()
  })

  it('falls back to the contact address when the network fails, keeping the draft', async () => {
    mockedPost.mockRejectedValue(new Error('network down'))
    renderApp()
    await openDialog()
    await fillAndSubmit()

    const error = await screen.findByTestId('bug-report-error')
    expect(error.textContent).toContain('Não conseguimos enviar o relato agora.')
    expect(error.textContent).toContain('ligadealgoritmos@gmail.com')
    expect(screen.getByTestId<HTMLTextAreaElement>('bug-report-description').value).toBe(
      'o botão de enviar não responde',
    )
  })

  it('keeps the draft after closing and reopening the dialog', async () => {
    renderApp()
    await openDialog()
    fireEvent.change(screen.getByTestId('bug-report-description'), {
      target: { value: 'rascunho a preservar' },
    })

    fireEvent.click(screen.getByTestId('bug-report-cancel'))
    await waitFor(() => expect(screen.queryByTestId('bug-report-dialog')).toBeNull())

    await openDialog()
    expect(screen.getByTestId<HTMLTextAreaElement>('bug-report-description').value).toBe(
      'rascunho a preservar',
    )
  })

  it('clears the draft only after a successful send', async () => {
    renderApp()
    await openDialog()
    await fillAndSubmit()
    await screen.findByTestId('bug-report-close')

    fireEvent.click(screen.getByTestId('bug-report-close'))
    await waitFor(() => expect(screen.queryByTestId('bug-report-dialog')).toBeNull())

    await openDialog()
    expect(screen.getByTestId<HTMLTextAreaElement>('bug-report-description').value).toBe('')
  })

  it.each([
    ['es', 'Reportar error'],
    ['en', 'Report a bug'],
  ])('renders the trigger in %s', async (language, label) => {
    await i18n.changeLanguage(language)
    renderApp()

    expect((await screen.findByTestId('bug-report-trigger')).textContent).toContain(label)
  })
})
