import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type AuthLayoutProps = {
  title: string
  description?: string
  poster?: ReactNode
  navigation?: ReactNode
  children: ReactNode
}

export function AuthLayout({ title, description, poster, navigation, children }: AuthLayoutProps) {
  return (
    <main
      className={cn(
        'grid w-full min-w-0 flex-1',
        poster && 'lg:grid-cols-[minmax(0,7fr)_minmax(0,9fr)]',
      )}
    >
      {poster && (
        <div className="hidden min-w-0 bg-chrome text-chrome-foreground lg:flex">{poster}</div>
      )}
      <section className="flex min-w-0 items-center justify-center px-6 py-10 lg:px-12 lg:py-16">
        <div className="w-full min-w-0 max-w-[400px] [&_input]:h-11 [&_button]:h-11 [&_[data-slot=button]]:h-11">
          <div className="mb-7">
            <h1 className="font-display font-bold text-4xl uppercase leading-none">{title}</h1>
            {description && <p className="mt-2 text-muted-foreground text-sm">{description}</p>}
          </div>
          {children}
          {navigation && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
              {navigation}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
