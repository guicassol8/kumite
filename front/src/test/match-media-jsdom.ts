// jsdom has no layout engine and never implements `window.matchMedia` — both
// `isCoarsePointer()` (react-resizable-panels) and T3's `useMediaQuery` call
// it. Minimal shim in the style of `radix-select-jsdom.ts`: enough surface
// for a real listener to attach without throwing, nothing that parses an
// actual media query. `setMatchMediaMatches` below is the test-only control
// point — it flips a query's `matches` and fires `change` the way crossing a
// breakpoint would in a real browser.

type ChangeListener = (event: MediaQueryListEvent) => void

type Entry = { matches: boolean; listeners: Set<ChangeListener> }

const registry = new Map<string, Entry>()

function entryFor(query: string): Entry {
  let entry = registry.get(query)
  if (!entry) {
    entry = { matches: false, listeners: new Set() }
    registry.set(query, entry)
  }
  return entry
}

if (!window.matchMedia) {
  window.matchMedia = ((query: string) => {
    const entry = entryFor(query)
    return {
      get matches() {
        return entry.matches
      },
      media: query,
      onchange: null,
      addEventListener: (_type: 'change', listener: ChangeListener) => {
        entry.listeners.add(listener)
      },
      removeEventListener: (_type: 'change', listener: ChangeListener) => {
        entry.listeners.delete(listener)
      },
      addListener: (listener: ChangeListener) => entry.listeners.add(listener),
      removeListener: (listener: ChangeListener) => entry.listeners.delete(listener),
      dispatchEvent: () => true,
    } as MediaQueryList
  }) as typeof window.matchMedia
}

/** Test-only: sets a query's `matches` and notifies its listeners. */
export function setMatchMediaMatches(query: string, matches: boolean): void {
  const entry = entryFor(query)
  if (entry.matches === matches) return
  entry.matches = matches
  const event = { matches, media: query } as MediaQueryListEvent
  for (const listener of [...entry.listeners]) listener(event)
}
