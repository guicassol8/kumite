/**
 * O estado do tema, fora do React: um módulo com assinantes, lido pelo
 * `useTheme` via `useSyncExternalStore`. Sem provider, porque o tema é uma
 * classe no `<html>` e uma meta no `<head>` — nada disso desce pela árvore.
 *
 * A chave e a regra de resolução são duplicadas no script anti-flash de
 * `index.html`, que precisa rodar antes do primeiro paint e portanto antes
 * deste módulo existir. `e2e/theme.spec.ts` é o guarda dessa duplicação.
 */
import { isPresentationActive } from './presentation-mode'

export const THEME_STORAGE_KEY = 'kumite:theme'

/** A preferência do SO que `system` segue (docs/design/identity.md § Modo de cor). */
export const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)'

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
 * A escolha salva vence; sem ela (`system`), vale o `prefers-color-scheme`
 * do SO. Sem `matchMedia` (ambiente sem layout), cai no claro — o mesmo
 * padrão de `use-media-query.ts`.
 */
export function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  if (choice !== 'system') return choice
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light'
  return window.matchMedia(DARK_SCHEME_QUERY).matches ? 'dark' : 'light'
}

/**
 * O modo que a escolha atual resolve agora. É um snapshot próprio para o
 * `useSyncExternalStore`: quando só o SO troca, a escolha continua `system`
 * e um snapshot da escolha não re-renderizaria ninguém.
 */
export function readResolvedTheme(): ResolvedTheme {
  return resolveTheme(readTheme())
}

/** Aplica no DOM o que `readTheme()` disser: a classe e a meta, nada mais. */
export function applyTheme(): void {
  const resolved = readResolvedTheme()
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
  notify()
}

function notify(): void {
  for (const listener of listeners) listener()
}

/**
 * Acompanha a troca de tema do SO ao vivo, com a aba aberta. Só repinta
 * quando a escolha é `system` — uma escolha salva vence o SO — e nunca
 * durante o telão, cujo escuro forçado vence tudo (o telão chama
 * `applyTheme()` ao sair). Os assinantes são avisados sempre, para o
 * `resolvedTheme` do `useTheme` não ficar velho. Devolve o cleanup.
 */
export function watchSystemTheme(): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => undefined
  }
  const query = window.matchMedia(DARK_SCHEME_QUERY)
  const onChange = () => {
    if (readTheme() === 'system' && !isPresentationActive()) applyTheme()
    notify()
  }
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
