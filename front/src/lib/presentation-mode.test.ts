import { afterEach, describe, expect, it, vi } from 'vitest'

import { isPresentationActive, setPresentationActive, subscribe } from './presentation-mode'

afterEach(() => {
  setPresentationActive(false)
})

describe('presentation-mode', () => {
  it('starts inactive', () => {
    expect(isPresentationActive()).toBe(false)
  })

  it('notifies subscribers when the value changes', () => {
    const listener = vi.fn()
    const unsubscribe = subscribe(listener)

    setPresentationActive(true)
    expect(isPresentationActive()).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    setPresentationActive(false)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('does not notify when setting the same value again', () => {
    const listener = vi.fn()
    subscribe(listener)

    setPresentationActive(true)
    setPresentationActive(true)

    expect(listener).toHaveBeenCalledTimes(1)
  })
})
