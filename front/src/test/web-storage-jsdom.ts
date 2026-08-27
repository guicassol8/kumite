// Node 22+ ships its own global `localStorage`/`sessionStorage` (behind
// --experimental-webstorage), which vitest's jsdom environment never
// overwrites because the keys already exist on globalThis. Left alone, that
// built-in getter shadows jsdom's real Storage instance and silently returns
// undefined. Rebind both to the backing Storage jsdom already created.
for (const key of ['localStorage', 'sessionStorage'] as const) {
  const backing = (globalThis as unknown as Record<string, unknown>)[`_${key}`]
  if (backing) {
    Object.defineProperty(globalThis, key, { configurable: true, value: backing })
  }
}
