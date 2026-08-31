import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { requireRole } from '@/lib/route-guards'

export const Route = createFileRoute('/organizer')({
  beforeLoad: requireRole('organizer'),
  component: OrganizerScreen,
})

function OrganizerScreen() {
  const { t } = useTranslation()

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center p-8">
      <h1 className="font-bold text-2xl" data-testid="organizer-stub">
        {t('organizer.stub.title')}
      </h1>
    </main>
  )
}
