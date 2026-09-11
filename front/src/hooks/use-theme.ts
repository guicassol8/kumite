import { useSyncExternalStore } from 'react'

import {
  type ResolvedTheme,
  readTheme,
  resolveTheme,
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
  return { theme, resolvedTheme: resolveTheme(theme), setTheme }
}
