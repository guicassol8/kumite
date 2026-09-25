import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import '@/i18n'
import { ActionsBar } from './actions-bar'

/** The element's classes as tokens — a substring match on the whole string
 * hits things like `aria-invalid:border-destructive` by accident. */
function classesOf(element: Element): string[] {
  return [...element.classList]
}

function renderBar(overrides: Partial<Parameters<typeof ActionsBar>[0]> = {}) {
  const props = {
    isRunning: false,
    onRun: vi.fn(),
    onClear: vi.fn(),
    isClosed: false,
    isSubmitting: false,
    isPaused: false,
    onSubmit: vi.fn(),
    ...overrides,
  }
  render(<ActionsBar {...props} />)
  return props
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('ActionsBar', () => {
  // #211: practice has no submission — without `onSubmit` there is no
  // Submeter at all, while Executar and Limpar stay.
  it('renders no Submeter without onSubmit, keeping Executar and Limpar', () => {
    render(<ActionsBar isRunning={false} onRun={vi.fn()} onClear={vi.fn()} isClosed={false} />)

    expect(screen.queryByTestId('problem-submit-button')).toBeNull()
    expect(screen.getByTestId('problem-run-button')).toBeTruthy()
    expect(screen.getByTestId('problem-clear-button')).toBeTruthy()
  })

  // #285: a pause disables Submeter only — Executar and Limpar keep working.
  it('disables only Submeter while submissions are paused', () => {
    renderBar({ isPaused: true })

    expect((screen.getByTestId('problem-submit-button') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByTestId('problem-run-button') as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByTestId('problem-clear-button') as HTMLButtonElement).disabled).toBe(false)
  })

  it('makes Submeter the only button filled in brand red', () => {
    renderBar()

    expect(classesOf(screen.getByTestId('problem-submit-button'))).toContain('bg-brand')

    const bar = screen.getByTestId('problem-actions-bar')
    const filled = [...bar.querySelectorAll('button')].filter((button) =>
      classesOf(button).includes('bg-brand'),
    )
    expect(filled).toHaveLength(1)
    expect(filled[0]).toBe(screen.getByTestId('problem-submit-button'))
  })

  it('keeps Executar an outline rather than a filled button', () => {
    renderBar()

    const run = screen.getByTestId('problem-run-button')
    expect(classesOf(run)).toContain('border')
    expect(classesOf(run)).not.toContain('bg-brand')
    expect(classesOf(run)).not.toContain('bg-primary')
  })

  it('reads Limpar blocos as crimson text, not as the outlined destructive', () => {
    renderBar()

    const clear = screen.getByTestId('problem-clear-button')
    expect(classesOf(clear)).toContain('text-destructive')
    // The `destructive` variant would draw a crimson border here; § 5 keeps
    // this one a plain text action. Token-wise, never as a substring: the
    // base button class carries `aria-invalid:border-destructive`, which a
    // `toContain` on the whole string matches by accident.
    expect(classesOf(clear)).not.toContain('border-destructive')
    expect(classesOf(clear)).not.toContain('border')
  })

  it('gives every action an icon', () => {
    renderBar()

    for (const testId of ['problem-run-button', 'problem-clear-button', 'problem-submit-button']) {
      expect(screen.getByTestId(testId).querySelector('svg')).not.toBeNull()
    }
  })

  it('swaps the labels for the progress ones while running and submitting', () => {
    const { unmount } = render(
      <ActionsBar
        isRunning
        onRun={vi.fn()}
        onClear={vi.fn()}
        isClosed={false}
        isSubmitting={false}
        onSubmit={vi.fn()}
      />,
    )
    expect(screen.getByTestId('problem-run-button').textContent).toContain('Executando...')
    expect(screen.getByTestId('problem-run-button')).toHaveProperty('disabled', true)

    unmount()
    renderBar({ isSubmitting: true })
    expect(screen.getByTestId('problem-submit-button').textContent).toContain('Enviando...')
    expect(screen.getByTestId('problem-submit-button')).toHaveProperty('disabled', true)
  })

  it('hides Submeter on a closed round and keeps the other two', () => {
    renderBar({ isClosed: true })

    expect(screen.queryByTestId('problem-submit-button')).toBeNull()
    expect(screen.getByTestId('problem-run-button')).toBeDefined()
    expect(screen.getByTestId('problem-clear-button')).toBeDefined()
  })

  it('still asks before clearing the blocks', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { onClear } = renderBar()

    fireEvent.click(screen.getByTestId('problem-clear-button'))
    expect(confirm).toHaveBeenCalled()
    expect(onClear).not.toHaveBeenCalled()

    confirm.mockReturnValue(true)
    fireEvent.click(screen.getByTestId('problem-clear-button'))
    expect(onClear).toHaveBeenCalledTimes(1)
  })
})
