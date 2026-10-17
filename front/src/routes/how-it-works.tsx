import { createFileRoute, Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { useTour } from '@/components/onboarding/tour-provider'
import { Button } from '@/components/ui/button'
import { useSession } from '@/hooks/use-session'

// Static and public (#213): reachable before signing up, from the header, the
// footer and the tour invite. The wording follows docs/product.md and the
// rules the back actually applies (team size and mixing from event-config,
// scoring from submissions/ranking) — no numbers the organizer can change.
export const Route = createFileRoute('/how-it-works')({
  component: HowItWorksScreen,
})

const HOW_IT_WORKS_SECTIONS = ['what', 'teams', 'rounds', 'editor', 'practice'] as const

function HowItWorksScreen() {
  const { t } = useTranslation()
  const { status } = useSession()
  const { startTour } = useTour()
  const isAuthenticated = status === 'authenticated'

  return (
    <main
      data-testid="how-it-works-screen"
      className="mx-auto flex w-full min-w-0 max-w-3xl flex-1 flex-col gap-6 px-4 py-6 md:gap-8 md:px-8 md:py-12"
    >
      <div className="flex flex-col gap-2">
        <h1 className="font-bold font-display text-4xl">{t('howItWorks.title')}</h1>
        <p className="text-muted-foreground">{t('howItWorks.intro')}</p>
      </div>

      {HOW_IT_WORKS_SECTIONS.map((id) => (
        <section
          key={id}
          data-testid={`how-it-works-section-${id}`}
          className="flex flex-col gap-2 border-t pt-5"
        >
          <h2 className="font-display font-semibold text-2xl">
            {t(`howItWorks.sections.${id}.title`)}
          </h2>
          <p className="leading-relaxed">{t(`howItWorks.sections.${id}.body`)}</p>
        </section>
      ))}

      {/* Practice and the tour both need an account: an anonymous reader gets
          the explanation, and the header's sign-up link is right there. */}
      {isAuthenticated && (
        <div className="flex flex-wrap items-center gap-3 border-t pt-5">
          <Button
            type="button"
            data-testid="how-it-works-start-tour"
            className="h-11 bg-brand text-brand-foreground hover:bg-brand-hover md:h-9"
            onClick={startTour}
          >
            {t('howItWorks.startTour')}
          </Button>
          <Button asChild variant="outline" className="h-11 md:h-9">
            <Link to="/practice" data-testid="how-it-works-practice-link">
              {t('howItWorks.practiceLink')}
            </Link>
          </Button>
        </div>
      )}
    </main>
  )
}
