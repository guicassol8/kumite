import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Lockup } from './lockup'
import { Mark } from './mark'
import { Wordmark } from './wordmark'

// The components carry a copy of the geometry versioned in docs/design/logo/.
// These tests read the SVGs themselves, so a regenerated logo that never
// reached paths.ts fails here instead of shipping a stale symbol.
const LOGO_DIR = path.resolve(import.meta.dirname, '../../../../docs/design/logo')

function readSvg(name: string): { ds: string[]; transforms: string[] } {
  const svg = readFileSync(path.join(LOGO_DIR, name), 'utf8')
  return {
    ds: [...svg.matchAll(/\sd="([^"]+)"/g)].map(([, d]) => d ?? ''),
    transforms: [...svg.matchAll(/transform="([^"]+)"/g)].map(([, t]) => t ?? ''),
  }
}

function pathsOf(element: Element | null): SVGPathElement[] {
  return [...(element?.querySelectorAll('path') ?? [])]
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Mark', () => {
  const source = readSvg('kumite-mark.svg')

  it('draws both blocks with the path of kumite-mark.svg', () => {
    const { container } = render(<Mark />)
    const drawn = pathsOf(container.querySelector('[data-testid="brand-mark"]'))

    expect(drawn).toHaveLength(2)
    expect(drawn.map((p) => p.getAttribute('d'))).toEqual([source.ds[0], source.ds[1]])
    expect(drawn[1]?.getAttribute('transform')).toBe(source.transforms[0])
  })

  it('keeps red on the left and the text colour on the right (Rule 1)', () => {
    const { container } = render(<Mark />)
    const [left, right] = pathsOf(container.querySelector('[data-testid="brand-mark"]'))

    expect(left?.getAttribute('class')).toContain('fill-brand')
    expect(left?.getAttribute('class')).toContain('stroke-brand')
    expect(right?.getAttribute('fill')).toBe('currentColor')
    expect(right?.getAttribute('stroke')).toBe('currentColor')
  })
})

describe('Wordmark', () => {
  const source = readSvg('kumite-wordmark.svg')

  it('draws the outlined wordmark of kumite-wordmark.svg', () => {
    const { container } = render(<Wordmark />)
    const svg = container.querySelector('[data-testid="brand-wordmark"]')
    const [drawn] = pathsOf(svg)

    expect(svg?.getAttribute('viewBox')).toBe('0 0 240.9 81.1')
    expect(drawn?.getAttribute('d')).toBe(source.ds[0])
    expect(drawn?.getAttribute('transform')).toBe(source.transforms[0])
    expect(drawn?.getAttribute('fill')).toBe('currentColor')
  })
})

describe('Lockup', () => {
  const source = readSvg('kumite-lockup-horizontal.svg')

  it('draws the symbol and the lockup own wordmark of kumite-lockup-horizontal.svg', () => {
    const { container } = render(<Lockup />)
    const svg = container.querySelector('[data-testid="brand-lockup"]')
    const drawn = pathsOf(svg)

    expect(svg?.getAttribute('viewBox')).toBe('0 0 212.09 64')
    expect(drawn).toHaveLength(3)
    expect(drawn.map((p) => p.getAttribute('d'))).toEqual(source.ds)
    // The lockup wordmark is outlined at its own size: reusing the standalone
    // one would land the wrong body next to the symbol.
    expect(drawn[2]?.getAttribute('d')).not.toBe(readSvg('kumite-wordmark.svg').ds[0])
    expect(drawn[2]?.getAttribute('transform')).toBe('translate(81.47 51.663)')
  })
})

describe('every brand component', () => {
  it('is aria-hidden by default, because the parent is what names it', () => {
    const { container } = render(
      <>
        <Mark />
        <Wordmark />
        <Lockup />
      </>,
    )

    for (const testid of ['brand-mark', 'brand-wordmark', 'brand-lockup']) {
      expect(
        container.querySelector(`[data-testid="${testid}"]`)?.getAttribute('aria-hidden'),
      ).toBe('true')
    }
  })

  it('takes a className and lets the caller override aria-hidden', () => {
    const { container } = render(<Mark aria-hidden={false} aria-label="kumite" className="h-6" />)
    const svg = container.querySelector('[data-testid="brand-mark"]')

    expect(svg?.getAttribute('class')).toBe('h-6')
    expect(svg?.getAttribute('aria-hidden')).toBe('false')
  })
})
