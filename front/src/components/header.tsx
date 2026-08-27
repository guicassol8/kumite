import { LanguageSelector } from '@/components/language-selector'

export function Header() {
  return (
    <header data-testid="app-header" className="flex items-center justify-between border-b p-4">
      <span className="font-bold text-xl tracking-tight">kumite</span>
      <LanguageSelector />
    </header>
  )
}
