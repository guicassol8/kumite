import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Sparkline } from './sparkline'

afterEach(() => {
  cleanup()
})

function points() {
  const line = screen.getByTestId('spark').querySelector('polyline')
  const raw = line?.getAttribute('points') ?? ''
  return raw
    .trim()
    .split(/\s+/)
    .map((pair) => pair.split(',').map(Number) as [number, number])
}

describe('Sparkline', () => {
  it('draws one point per value, left to right', () => {
    render(<Sparkline values={Array.from({ length: 15 }, (_, i) => i)} label="x" testId="spark" />)

    const xs = points().map(([x]) => x)
    expect(xs).toHaveLength(15)
    expect(xs).toEqual([...xs].sort((a, b) => a - b))
  })

  it('puts the largest value at the top and zero at the baseline', () => {
    render(<Sparkline values={[0, 5, 10]} label="x" testId="spark" />)

    const ys = points().map(([, y]) => y)
    // SVG y grows downwards: the peak has the smallest y.
    expect(ys[2]).toBeLessThan(ys[1] ?? 0)
    expect(ys[1]).toBeLessThan(ys[0] ?? 0)
  })

  it('draws a flat line on the baseline when every value is zero', () => {
    render(<Sparkline values={[0, 0, 0, 0]} label="x" testId="spark" />)

    const ys = points().map(([, y]) => y)
    expect(ys.every((y) => Number.isFinite(y))).toBe(true)
    expect(new Set(ys).size).toBe(1)
  })

  it('exposes itself as an image with the given label', () => {
    render(<Sparkline values={[1, 2]} label="Submissions per minute" testId="spark" />)

    const svg = screen.getByRole('img', { name: 'Submissions per minute' })
    expect(svg.getAttribute('data-testid')).toBe('spark')
  })
})
