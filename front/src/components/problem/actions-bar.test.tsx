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
  // #212: "Ver como se resolve" exists only when the screen hands a demo in.
  it('offers no demo without onShowDemo', () => {
    renderBar()

    expect(screen.queryByTestId('practice-demo-start')).toBeNull()
  })

  it('offers the demo with onShowDemo, and reports the click', () => {
    const onShowDemo = vi.fn()
    render(
      <ActionsBar
        isRunning={false}
        onRun={vi.fn()}
        onClear={vi.fn()}
        isClosed={false}
        onShowDemo={onShowDemo}
      />,
    )

    fireEvent.click(screen.getByTestId('practice-demo-start'))

    expect(screen.getByTestId('practice-demo-start').textContent).toContain('Ver como se resolve')
    expect(onShowDemo).toHaveBeenCalledTimes(1)
  })

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

  // #200.2: Executar still works on a closed round, and nothing said it no
  // longer counts. The hint sits where Submeter used to, tied to the button.
  it('says beside Executar that a run on a closed round scores no points', () => {
    renderBar({ isClosed: true })

    const hint = screen.getByTestId('problem-run-closed-hint')
    expect(hint.textContent).toBe(
      'Rodada encerrada: executar só testa os exemplos e não vale pontos.',
    )
    expect(screen.getByTestId('problem-run-button').getAttribute('aria-describedby')).toBe(hint.id)
    expect(hint.id).not.toBe('')
  })

  // On a phone (< 640px wide) 700px tall or less the hint's second line took
  // the results band down to a 25px sliver (problem-layout.spec.ts, #155).
  // There it is only for screen readers, still named by Executar's
  // aria-describedby; the real-browser half of this is that e2e at 360x640.
  it('keeps the closed-round hint for screen readers only on a short phone', () => {
    renderBar({ isClosed: true })

    const hint = screen.getByTestId('problem-run-closed-hint')
    // Short AND narrow: a laptop at 1366x768 is short too, but its single
    // line costs the band nothing, so it keeps the visible hint.
    expect(classesOf(hint)).toContain('max-sm:short:sr-only')
    expect(classesOf(hint).filter((token) => token.endsWith('sr-only'))).toEqual([
      'max-sm:short:sr-only',
    ])
    expect(screen.getByTestId('problem-run-button').getAttribute('aria-describedby')).toBe(hint.id)
  })

  it.each([
    ['a round in progress', {}],
    ['practice', { onSubmit: undefined }],
  ])('shows no closed-round hint in %s', (_label, overrides) => {
    renderBar(overrides)

    expect(screen.queryByTestId('problem-run-closed-hint')).toBeNull()
    expect(screen.getByTestId('problem-run-button').getAttribute('aria-describedby')).toBeNull()
  })

  // #283: the app's own AlertDialog, never the browser's `window.confirm`.
  it('asks in an app dialog before clearing the blocks, and never through window.confirm', () => {
    const confirm = vi.spyOn(window, 'confirm')
    const { onClear } = renderBar()

    fireEvent.click(screen.getByTestId('problem-clear-button'))

    const dialog = screen.getByTestId('problem-clear-dialog')
    expect(dialog.textContent).toContain('Limpar os blocos?')
    expect(dialog.textContent).toContain('Isso vai apagar todos os blocos deste problema.')
    expect(onClear).not.toHaveBeenCalled()
    expect(confirm).not.toHaveBeenCalled()
  })

  it('leaves the blocks alone when the dialog is cancelled', () => {
    const { onClear } = renderBar()

    fireEvent.click(screen.getByTestId('problem-clear-button'))
    fireEvent.click(screen.getByTestId('problem-clear-cancel'))

    expect(screen.queryByTestId('problem-clear-dialog')).toBeNull()
    expect(onClear).not.toHaveBeenCalled()
  })

  it('clears the blocks once the dialog is confirmed', () => {
    const confirm = vi.spyOn(window, 'confirm')
    const { onClear } = renderBar()

    fireEvent.click(screen.getByTestId('problem-clear-button'))
    fireEvent.click(screen.getByTestId('problem-clear-confirm'))

    expect(onClear).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('problem-clear-dialog')).toBeNull()
    expect(confirm).not.toHaveBeenCalled()
  })
})
