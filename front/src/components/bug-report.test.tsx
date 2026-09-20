import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  api: {
    'bug-reports': { $post: vi.fn() },
  },
}))

import { BugReport } from '@/components/bug-report'
import { DialogTrigger } from '@/components/ui/dialog'
import i18n from '@/i18n'
import { api } from '@/lib/api'
import { clearSession, type SessionUser, setSession } from '@/lib/session'

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

// The second account of the session-change cases (#194): a different id *and*
// a different address, so an assertion cannot pass by accident.
const otherUser: SessionUser = {
  ...fakeUser,
  id: 'u2',
  name: 'Grace Hopper',
  email: 'grace@edu.pucrs.br',
}

// The dialog only, mounted with a trigger of the test's own choosing (#217):
// the real triggers (one per viewport) now live in the header, covered by
// header.test.tsx. `useRouterState` still needs a router underneath, so this
// is a route tree of its own — same pattern as header.test.tsx — rather than
// the full `routeTree.gen`.
function TestBugReport() {
  // BugReport is a controlled dialog (#217): the mobile menu row can't be a
  // `<DialogTrigger>` of its own (it lives inside a Sheet, built on the same
  // Dialog primitive, so a nested trigger would bind to the Sheet's context
  // instead), so the header owns `open` and this harness mirrors that.
  const [open, setOpen] = useState(false)
  return (
    <BugReport open={open} onOpenChange={setOpen}>
      <DialogTrigger data-testid="bug-report-trigger">abrir</DialogTrigger>
    </BugReport>
  )
}

const rootRoute = createRootRoute({ component: TestBugReport })
const routeTree = rootRoute.addChildren(
  ['/', '/login'].map((path) =>
    createRoute({ getParentRoute: () => rootRoute, path, component: () => null }),
  ),
)

function renderApp(initialEntry = '/login') {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  })
  render(<RouterProvider router={router} />)
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

  // The envelope now carries an issue naming `description`: since #194 only an
  // issue that names a field of the form may blame that field, and a 422 with
  // no issues at all is the context case below.
  it('reports a validation refusal from the API (422) without closing the dialog', async () => {
    mockedPost.mockResolvedValue(
      jsonResponse(422, {
        error: 'validation_failed',
        issues: {
          body: [{ path: 'description', message: 'String must contain at least 1 character(s)' }],
        },
      }),
    )
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

  // #194 — the three findings below all come from the same root cause: this
  // component is mounted once in the header (which lives in `__root.tsx`) and
  // never unmounts, so react-hook-form state crosses a logout. Every case
  // therefore uses a single `render` and swaps the session underneath it —
  // a reload would remount the SPA and hide the bug.

  it('shows nothing of the previous account to the next one in the same tab', async () => {
    setSession(fakeUser, 'tok-1')
    renderApp()
    await openDialog()
    await waitFor(() =>
      expect(screen.getByTestId<HTMLInputElement>('bug-report-email').value).toBe(
        'ada@edu.pucrs.br',
      ),
    )
    fireEvent.change(screen.getByTestId('bug-report-description'), {
      target: { value: 'rascunho da Ada' },
    })
    fireEvent.click(screen.getByTestId('bug-report-cancel'))
    await waitFor(() => expect(screen.queryByTestId('bug-report-dialog')).toBeNull())

    // `setSession`/`clearSession` drive a `useSyncExternalStore` from outside
    // React — without `act()` the re-render is not flushed and the case would
    // fail for the wrong reason.
    act(() => clearSession('manual'))
    act(() => setSession(otherUser, 'tok-2'))

    await openDialog()
    await waitFor(() =>
      expect(screen.getByTestId<HTMLInputElement>('bug-report-email').value).toBe(
        'grace@edu.pucrs.br',
      ),
    )
    expect(screen.getByTestId<HTMLTextAreaElement>('bug-report-description').value).toBe('')
  })

  it('truncates a user agent longer than the ceiling the API accepts', async () => {
    const longAgent = 'A'.repeat(700)
    Object.defineProperty(navigator, 'userAgent', { value: longAgent, configurable: true })
    try {
      renderApp()
      await openDialog()
      await fillAndSubmit()

      await waitFor(() => expect(mockedPost).toHaveBeenCalledOnce())
      const [payload] = mockedPost.mock.calls[0] ?? []
      const json = (payload as { json: Record<string, unknown> }).json
      const context = json.context as { userAgent: string }

      expect(context.userAgent.length).toBeLessThanOrEqual(500)
      expect(longAgent.startsWith(context.userAgent)).toBe(true)
    } finally {
      // Deleting the own property uncovers jsdom's prototype getter again.
      delete (navigator as unknown as Record<string, unknown>).userAgent
    }
  })

  it('does not blame the description or the email when only the context is refused', async () => {
    mockedPost.mockResolvedValue(
      jsonResponse(422, {
        error: 'validation_failed',
        issues: {
          body: [
            {
              path: 'context.userAgent',
              message: 'String must contain at most 500 character(s)',
              code: 'too_big',
            },
          ],
        },
      }),
    )
    renderApp()
    await openDialog()
    await fillAndSubmit()

    const error = await screen.findByTestId('bug-report-error')
    expect(error.textContent).not.toContain('confira a descrição')
    expect(error.textContent).toContain('Não conseguimos enviar o relato agora.')
  })

  // The other half of the ownership check, and the reason it is written
  // `ownerRef.current !== null && ...` rather than a bare inequality: the reset
  // above must not fire for the *same* person. Without these three the guard
  // can be dropped and every case above still passes, while the draft promised
  // by #145 starts disappearing under its own author.

  it('keeps the draft and the address across close and reopen for the same account', async () => {
    setSession(fakeUser, 'tok-1')
    renderApp()
    await openDialog()
    await waitFor(() =>
      expect(screen.getByTestId<HTMLInputElement>('bug-report-email').value).toBe(
        'ada@edu.pucrs.br',
      ),
    )
    fireEvent.change(screen.getByTestId('bug-report-description'), {
      target: { value: 'rascunho da Ada' },
    })
    fireEvent.click(screen.getByTestId('bug-report-cancel'))
    await waitFor(() => expect(screen.queryByTestId('bug-report-dialog')).toBeNull())

    await openDialog()
    expect(screen.getByTestId<HTMLTextAreaElement>('bug-report-description').value).toBe(
      'rascunho da Ada',
    )
    expect(screen.getByTestId<HTMLInputElement>('bug-report-email').value).toBe('ada@edu.pucrs.br')
  })

  it('keeps a draft started while anonymous when its author then signs in', async () => {
    renderApp()
    await openDialog()
    fireEvent.change(screen.getByTestId('bug-report-description'), {
      target: { value: 'rascunho comecado deslogado' },
    })
    fireEvent.click(screen.getByTestId('bug-report-cancel'))
    await waitFor(() => expect(screen.queryByTestId('bug-report-dialog')).toBeNull())

    act(() => setSession(fakeUser, 'tok-1'))

    await openDialog()
    expect(screen.getByTestId<HTMLTextAreaElement>('bug-report-description').value).toBe(
      'rascunho comecado deslogado',
    )
    // The address was never typed, so signing in fills it — the draft is the
    // same person's either way.
    await waitFor(() =>
      expect(screen.getByTestId<HTMLInputElement>('bug-report-email').value).toBe(
        'ada@edu.pucrs.br',
      ),
    )
  })

  it('gives the draft back to whoever comes back from an expired session', async () => {
    setSession(fakeUser, 'tok-1')
    renderApp()
    await openDialog()
    fireEvent.change(screen.getByTestId('bug-report-description'), {
      target: { value: 'rascunho da Ada' },
    })
    fireEvent.click(screen.getByTestId('bug-report-cancel'))
    await waitFor(() => expect(screen.queryByTestId('bug-report-dialog')).toBeNull())

    // The session dies on its own and the same person signs back in — which is
    // why the check is on *opening* and not in an effect watching the session:
    // an effect would have wiped the draft the moment the token expired.
    act(() => clearSession('expired'))
    act(() => setSession(fakeUser, 'tok-2'))

    await openDialog()
    expect(screen.getByTestId<HTMLTextAreaElement>('bug-report-description').value).toBe(
      'rascunho da Ada',
    )
  })

  it('opens clean after a failed send was dismissed', async () => {
    mockedPost.mockRejectedValue(new Error('network down'))
    renderApp()
    await openDialog()
    await fillAndSubmit()
    await screen.findByTestId('bug-report-error')

    fireEvent.click(screen.getByTestId('bug-report-cancel'))
    await waitFor(() => expect(screen.queryByTestId('bug-report-dialog')).toBeNull())

    await openDialog()
    expect(screen.queryByTestId('bug-report-error')).toBeNull()
  })
})
