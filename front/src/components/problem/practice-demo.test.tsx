import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import * as Blockly from 'blockly'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import i18n from '@/i18n'
import { applyBlocklyLocale } from '@/lib/blockly-setup'
import { blockIdsIn, demoStepState, outermostRevealedAt } from '@/lib/practice-demo'
import { PRACTICE_DEMOS } from '@/lib/practice-demos'
import { PracticeDemoCanvas, PracticeDemoControls } from './practice-demo'

const script = PRACTICE_DEMOS['e-par']

/** Block ids on the demo canvas, read from Blockly's own svg (`data-id`). */
function canvasBlockIds(): string[] {
  const canvas = screen.getByTestId('practice-demo-canvas')
  return [...canvas.querySelectorAll('[data-id]')]
    .map((node) => node.getAttribute('data-id') ?? '')
    .sort()
}

/** Ids of the demo's blocks that carry a Blockly class on their svg group. */
function canvasBlocksWith(className: string): string[] {
  const canvas = screen.getByTestId('practice-demo-canvas')
  return [...canvas.querySelectorAll(`[data-id].${className}`)]
    .map((node) => node.getAttribute('data-id') ?? '')
    .sort()
}

function renderControls(step: number) {
  const handlers = { onPrev: vi.fn(), onNext: vi.fn(), onExit: vi.fn() }
  const utils = render(<PracticeDemoControls script={script} step={step} {...handlers} />)
  return { ...handlers, ...utils }
}

beforeAll(() => {
  applyBlocklyLocale('pt')
})

afterEach(async () => {
  cleanup()
  await act(() => i18n.changeLanguage('pt'))
})

describe('PracticeDemoControls', () => {
  it('disables Anterior on the first step, never Próximo', () => {
    renderControls(0)

    expect(screen.getByTestId('practice-demo-prev')).toHaveProperty('disabled', true)
    expect(screen.getByTestId('practice-demo-next')).toHaveProperty('disabled', false)
  })

  it('disables Próximo on the last step, never Anterior', () => {
    renderControls(script.steps.length - 1)

    expect(screen.getByTestId('practice-demo-next')).toHaveProperty('disabled', true)
    expect(screen.getByTestId('practice-demo-prev')).toHaveProperty('disabled', false)
  })

  it('says where the participant is in the script', () => {
    renderControls(1)

    expect(screen.getByTestId('practice-demo-position').textContent).toBe('Passo 2 de 6')
    expect(screen.getByTestId('practice-demo-step-text').textContent).toBe(
      i18n.t('practice.demo.steps.e-par.2'),
    )
  })

  it('announces the step text politely to screen readers', () => {
    renderControls(0)

    expect(screen.getByTestId('practice-demo-step-text').getAttribute('aria-live')).toBe('polite')
  })

  it('switches the language and keeps the step', async () => {
    renderControls(3)

    await act(() => i18n.changeLanguage('en'))

    expect(screen.getByTestId('practice-demo-position').textContent).toBe('Step 4 of 6')
    expect(screen.getByTestId('practice-demo-step-text').textContent).toBe(
      'The number to divide is the "input".',
    )
  })

  it('reports Anterior, Próximo and Sair', () => {
    const { onPrev, onNext, onExit } = renderControls(2)

    fireEvent.click(screen.getByTestId('practice-demo-prev'))
    fireEvent.click(screen.getByTestId('practice-demo-next'))
    fireEvent.click(screen.getByTestId('practice-demo-exit'))

    expect(onPrev).toHaveBeenCalledTimes(1)
    expect(onNext).toHaveBeenCalledTimes(1)
    expect(onExit).toHaveBeenCalledTimes(1)
  })
})

describe('PracticeDemoCanvas', () => {
  it('shows exactly the blocks of the step', () => {
    render(<PracticeDemoCanvas script={script} step={2} />)

    expect(canvasBlockIds()).toEqual([...blockIdsIn(demoStepState(script, 2))].sort())
  })

  it('rebuilds the canvas when the step moves, both ways', () => {
    const { rerender } = render(<PracticeDemoCanvas script={script} step={0} />)
    expect(canvasBlockIds()).toEqual(['raiz'])

    rerender(<PracticeDemoCanvas script={script} step={5} />)
    expect(canvasBlockIds()).toEqual([...blockIdsIn(script.solution)].sort())

    rerender(<PracticeDemoCanvas script={script} step={1} />)
    expect(canvasBlockIds()).toEqual(['raiz', 'restoZero'])
  })

  it('keeps the step through a language switch, relabelled', async () => {
    render(<PracticeDemoCanvas script={script} step={3} />)
    const before = canvasBlockIds()

    await act(() => i18n.changeLanguage('en'))

    expect(canvasBlockIds()).toEqual(before)
    expect(screen.getByTestId('practice-demo-canvas').textContent).toContain('solve')
  })

  // #212 review (option A): the block that just entered wears the editor's
  // selection glow (the theme's selectedGlowColour), never highlightBlock's
  // emboss, which lightened it into looking disabled. Visual only: nothing is
  // selected globally, so no key and no other canvas ever sees it.
  it('glows the outermost block that just entered, and lightens none', () => {
    const { rerender } = render(<PracticeDemoCanvas script={script} step={2} />)
    expect(canvasBlocksWith('blocklySelected')).toEqual(outermostRevealedAt(script, 2))
    expect(canvasBlocksWith('blocklyHighlighted')).toEqual([])

    rerender(<PracticeDemoCanvas script={script} step={3} />)
    expect(canvasBlocksWith('blocklySelected')).toEqual(outermostRevealedAt(script, 3))
    expect(canvasBlocksWith('blocklyHighlighted')).toEqual([])
  })

  it('never selects a block for real', () => {
    render(<PracticeDemoCanvas script={script} step={1} />)

    expect(Blockly.common.getSelected()).toBeNull()
  })

  it('labels itself as the read-only demo, not as the editor', () => {
    render(<PracticeDemoCanvas script={script} step={0} />)

    expect(screen.getByTestId('practice-demo-canvas').getAttribute('aria-label')).toBe(
      i18n.t('practice.demo.canvasLabel'),
    )
    expect(screen.queryByTestId('blockly-workspace')).toBeNull()
    expect(screen.getByTestId('practice-demo-canvas').querySelector('.blocklyToolbox')).toBeNull()
  })
})
