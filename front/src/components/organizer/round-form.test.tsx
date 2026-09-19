import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  api: {
    organizer: {
      problems: Object.assign(vi.fn(), { $get: vi.fn() }),
    },
  },
}))

import '@/i18n'

import { api } from '@/lib/api'

import { RoundForm, type RoundFormValues } from './round-form'

const mockedList = vi.mocked(api.organizer.problems.$get)

// biome-ignore lint/suspicious/noExplicitAny: minimal fetch Response stubs
function jsonResponse(status: number, body: unknown): any {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

const problemA = {
  id: 'p1',
  points: 10,
  difficulty: 'easy',
  status: 'published',
  testCaseCount: 2,
  translations: [{ locale: 'pt', title: 'Soma' }],
}

const problemB = {
  id: 'p2',
  points: 20,
  difficulty: 'hard',
  status: 'published',
  testCaseCount: 4,
  translations: [{ locale: 'pt', title: 'Ordenação' }],
}

const draftProblem = {
  id: 'p3',
  points: 5,
  difficulty: 'medium',
  status: 'draft',
  testCaseCount: 0,
  translations: [{ locale: 'pt', title: 'Rascunho' }],
}

function emptyValues(): RoundFormValues {
  return { name: '', durationMinutes: 30, problemIds: [] }
}

function renderForm(props: Partial<React.ComponentProps<typeof RoundForm>> = {}) {
  const onSave = vi.fn()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <RoundForm initialValues={emptyValues()} onSave={onSave} {...props} />
    </QueryClientProvider>,
  )
  return { onSave }
}

beforeEach(() => {
  mockedList.mockReset()
  mockedList.mockResolvedValue(jsonResponse(200, [problemA, problemB, draftProblem]))
})

afterEach(cleanup)

describe('RoundForm', () => {
  it('renders seeded values and only published problems', async () => {
    renderForm({
      initialValues: { name: 'Rodada 1', durationMinutes: 45, problemIds: ['p2'] },
    })

    await waitFor(() => expect(screen.getByTestId('round-form-problem-p1')).toBeDefined())
    expect((screen.getByTestId('round-form-name') as HTMLInputElement).value).toBe('Rodada 1')
    expect((screen.getByTestId('round-form-duration') as HTMLInputElement).value).toBe('45')
    expect(
      (screen.getByTestId('round-form-problem-p2-checkbox') as HTMLButtonElement).dataset.state,
    ).toBe('checked')
    expect(screen.queryByTestId('round-form-problem-p3')).toBeNull()
  })

  it('toggling a checkbox adds it to the tail of problemIds and removes it on uncheck', async () => {
    const { onSave } = renderForm()

    await waitFor(() => expect(screen.getByTestId('round-form-problem-p1')).toBeDefined())
    fireEvent.change(screen.getByTestId('round-form-name'), { target: { value: 'Rodada 1' } })
    fireEvent.click(screen.getByTestId('round-form-problem-p1-checkbox'))
    fireEvent.click(screen.getByTestId('round-form-problem-p2-checkbox'))
    fireEvent.click(screen.getByTestId('round-form-save'))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({ problemIds: ['p1', 'p2'] })

    fireEvent.click(screen.getByTestId('round-form-problem-p1-checkbox'))
    fireEvent.click(screen.getByTestId('round-form-save'))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2))
    expect(onSave.mock.calls[1]?.[0]).toMatchObject({ problemIds: ['p2'] })
  })

  it('reorders two selected problems with the up/down buttons', async () => {
    const { onSave } = renderForm({
      initialValues: { name: 'Rodada 1', durationMinutes: 30, problemIds: ['p1', 'p2'] },
    })

    await waitFor(() => expect(screen.getByTestId('round-form-problem-p2-up')).toBeDefined())
    expect((screen.getByTestId('round-form-problem-p1-up') as HTMLButtonElement).disabled).toBe(
      true,
    )
    fireEvent.click(screen.getByTestId('round-form-problem-p2-up'))
    fireEvent.click(screen.getByTestId('round-form-save'))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({ problemIds: ['p2', 'p1'] })
  })

  it('blocks submit and shows the mapped error for an invalid name/duration', async () => {
    const { onSave } = renderForm({
      initialValues: { name: '', durationMinutes: 0, problemIds: [] },
    })

    await waitFor(() => expect(screen.getByTestId('round-form')).toBeDefined())
    fireEvent.click(screen.getByTestId('round-form-save'))

    await waitFor(() =>
      expect(screen.getByTestId('round-form-name-error').textContent).toContain(
        'Informe o nome da rodada',
      ),
    )
    expect(screen.getByTestId('round-form-duration-error').textContent).toContain(
      'Informe uma duração inteira maior que zero.',
    )
    expect(onSave).not.toHaveBeenCalled()
  })

  it('calls onSave with the built payload on a valid submit', async () => {
    const { onSave } = renderForm({
      initialValues: { name: 'Rodada final', durationMinutes: 60, problemIds: ['p1'] },
    })

    await waitFor(() => expect(screen.getByTestId('round-form')).toBeDefined())
    fireEvent.click(screen.getByTestId('round-form-save'))

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        name: 'Rodada final',
        durationMinutes: 60,
        problemIds: ['p1'],
      }),
    )
  })
})

/** The element's classes as tokens — a substring match on the whole string
 * hits things like `aria-invalid:border-destructive` by accident. */
function classesOf(element: Element): string[] {
  return [...element.classList]
}

function labelFor(testid: string): Element {
  const field = screen.getByTestId(testid)
  const id = field.getAttribute('id')
  const label = id ? document.querySelector(`label[for="${id}"]`) : null
  if (!label) throw new Error(`no label bound to ${testid}`)
  return label
}

// #233 — the round form in the new identity.
describe('RoundForm in the panel identity', () => {
  it('has no brand-red button: "Abrir rodada" lives in its own dialog, not here', async () => {
    renderForm()
    await waitFor(() => expect(screen.getByTestId('round-form')).toBeDefined())

    const branded = [...screen.getByTestId('round-form').querySelectorAll('button')].filter(
      (button) => classesOf(button).includes('bg-brand'),
    )
    expect(branded).toHaveLength(0)
    expect(classesOf(screen.getByTestId('round-form-save'))).toContain('bg-primary')
  })

  it('renders field labels at 13/500', async () => {
    renderForm()
    await waitFor(() => expect(screen.getByTestId('round-form')).toBeDefined())

    for (const testid of ['round-form-name', 'round-form-duration']) {
      const classes = classesOf(labelFor(testid))
      expect(classes).toContain('text-[13px]')
      expect(classes).toContain('font-medium')
    }
  })

  it('paints a rejected duration with a crimson outline and 13 px crimson text', async () => {
    renderForm()
    await waitFor(() => expect(screen.getByTestId('round-form')).toBeDefined())

    fireEvent.change(screen.getByTestId('round-form-duration'), { target: { value: '0' } })
    fireEvent.click(screen.getByTestId('round-form-save'))

    await waitFor(() => expect(screen.getByTestId('round-form-duration-error')).toBeTruthy())
    const message = screen.getByTestId('round-form-duration-error')
    expect(classesOf(message)).toContain('text-[13px]')
    expect(classesOf(message)).toContain('text-destructive')
    expect(classesOf(message)).not.toContain('bg-destructive')
    expect(screen.getByTestId('round-form-duration').getAttribute('aria-invalid')).toBe('true')
  })

  it('reorders with Lucide arrows instead of glyphs', async () => {
    renderForm({ initialValues: { name: 'Final', durationMinutes: 30, problemIds: ['p1', 'p2'] } })
    await waitFor(() => expect(screen.getByTestId('round-form-problem-p1-up')).toBeDefined())

    const up = screen.getByTestId('round-form-problem-p2-up')
    expect(up.textContent).not.toContain('↑')
    expect(up.querySelector('svg')).toBeTruthy()
    expect(up.getAttribute('aria-label')).toBeTruthy()

    const down = screen.getByTestId('round-form-problem-p1-down')
    expect(down.textContent).not.toContain('↓')
    expect(down.querySelector('svg')).toBeTruthy()
  })
})
