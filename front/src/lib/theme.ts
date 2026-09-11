/**
 * O estado do tema, fora do React: um módulo com assinantes, lido pelo
 * `useTheme` via `useSyncExternalStore`. Sem provider, porque o tema é uma
 * classe no `<html>` e uma meta no `<head>` — nada disso desce pela árvore.
 *
 * A chave e a regra de resolução são duplicadas no script anti-flash de
 * `index.html`, que precisa rodar antes do primeiro paint e portanto antes
 * deste módulo existir. `e2e/theme.spec.ts` é o guarda dessa duplicação.
 */
export const THEME_STORAGE_KEY = 'kumite:theme'

export type ThemeChoice = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

/**
 * O `--chrome` de cada modo (docs/design/tokens/tokens.css). A meta
 * `theme-color` pinta a barra do navegador no mobile, então ela acompanha o
 * modo em tela — nunca o que o sistema operacional prefere.
 */
const CHROME_COLOR: Record<ResolvedTheme, string> = {
  light: '#1c1716',
  dark: '#0e0c0b',
}

// Espelho do que foi escolhido nesta aba. É o que sobra quando o
// localStorage está bloqueado (aba anônima, cookies desligados): a escolha
// não atravessa um F5, mas o tema troca na hora em vez de não fazer nada.
let inMemoryChoice: ThemeChoice = 'system'

const listeners = new Set<() => void>()

function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function readTheme(): ThemeChoice {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY)
    if (isThemeChoice(raw)) return raw
  } catch {
    // localStorage indisponível — cai no espelho em memória.
  }
  return inMemoryChoice
}

/**
 * `system` resolve para claro DE PROPÓSITO enquanto o epic #214 estiver
 * aberto: as telas são desenhadas no claro primeiro, e um visitante com o SO
 * em escuro veria o redesign pela metade. Quem religa o
 * `prefers-color-scheme` é a #234 — não "conserte" isso aqui por engano.
 */
export function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  return choice === 'dark' ? 'dark' : 'light'
}

/** Aplica no DOM o que `readTheme()` disser: a classe e a meta, nada mais. */
export function applyTheme(): void {
  const resolved = resolveTheme(readTheme())
  document.documentElement.classList.toggle('dark', resolved === 'dark')
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', CHROME_COLOR[resolved])
}

export function setTheme(choice: ThemeChoice): void {
  inMemoryChoice = choice
  try {
    localStorage.setItem(THEME_STORAGE_KEY, choice)
  } catch {
    // Ver inMemoryChoice: a troca vale para esta aba mesmo sem persistir.
  }
  applyTheme()
  for (const listener of listeners) listener()
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
