import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { requireRole } from '@/lib/route-guards'

export const Route = createFileRoute('/organizer')({
  beforeLoad: requireRole('organizer'),
  component: OrganizerScreen,
})

function OrganizerScreen() {
  const { t } = useTranslation()

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-8">
      <h1 className="font-bold text-2xl" data-testid="organizer-stub">
        {t('organizer.stub.title')}
      </h1>
      <nav className="flex items-center gap-4 border-b pb-2">
        <Link
          to="/organizer/problems"
          data-testid="organizer-nav-problems"
          activeProps={{ className: 'font-semibold text-foreground' }}
          className="text-muted-foreground text-sm"
        >
          {t('organizer.nav.problems')}
        </Link>
        <Link
          to="/organizer/rounds"
          data-testid="organizer-nav-rounds"
          activeProps={{ className: 'font-semibold text-foreground' }}
          className="text-muted-foreground text-sm"
        >
          {t('organizer.nav.rounds')}
        </Link>
      </nav>
      <Outlet />
    </main>
  )
}
