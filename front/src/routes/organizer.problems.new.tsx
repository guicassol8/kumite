import { createFileRoute, Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

export const Route = createFileRoute('/organizer/problems/new')({
  component: NewProblemPlaceholder,
})

function NewProblemPlaceholder() {
  const { t } = useTranslation()

  return (
    <div data-testid="organizer-problems-placeholder" className="flex flex-col gap-4">
      <h2 className="font-semibold text-xl">{t('organizer.problems.placeholder.title')}</h2>
      <p className="text-muted-foreground">{t('organizer.problems.placeholder.description')}</p>
      <Link to="/organizer/problems" className="text-primary text-sm underline">
        {t('organizer.problems.placeholder.back')}
      </Link>
    </div>
  )
}
