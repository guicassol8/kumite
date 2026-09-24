import { useSyncExternalStore } from 'react'

import {
  type ResolvedTheme,
  readResolvedTheme,
  readTheme,
  setTheme,
  subscribe,
  type ThemeChoice,
} from '@/lib/theme'

export function useTheme(): {
  theme: ThemeChoice
  resolvedTheme: ResolvedTheme
  setTheme: (choice: ThemeChoice) => void
} {
  const theme = useSyncExternalStore(subscribe, readTheme)
  // Snapshot à parte: com a escolha em `system`, uma troca só do SO muda o
  // modo resolvido sem mudar a escolha.
  const resolvedTheme = useSyncExternalStore(subscribe, readResolvedTheme)
  return { theme, resolvedTheme, setTheme }
}
