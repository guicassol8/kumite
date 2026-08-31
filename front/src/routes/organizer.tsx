import { createFileRoute, Outlet } from '@tanstack/react-router'
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
      <Outlet />
    </main>
  )
}
