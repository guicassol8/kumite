import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useOnboardingInvite } from '@/hooks/use-onboarding-invite'

/**
 * The first-access invite to the guided tour (#213): an inline card at the top
 * of the home, never a modal — it cannot trap navigation, and it never sits on
 * top of a competition (it waits out any open round). Accepting starts the
 * tour right away; declining just hides it. Either answer is asked once per
 * account, on the back.
 */
export function OnboardingInvite() {
  const { t } = useTranslation()
  const { offer, saveFailed, accept, decline, dismissSaveError } = useOnboardingInvite()

  if (saveFailed) {
    return (
      <Alert data-testid="onboarding-invite-save-error">
        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
          <span>{t('onboarding.saveError.message')}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="onboarding-invite-save-error-dismiss"
            onClick={dismissSaveError}
          >
            {t('onboarding.saveError.dismiss')}
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (!offer) return null

  return (
    <Card className="w-full gap-3 border-brand py-5" data-testid="onboarding-invite">
      <CardContent className="flex flex-col gap-3 px-5 md:px-6">
        <h2 className="font-display font-semibold text-xl">{t('onboarding.invite.title')}</h2>
        <p className="text-sm">{t('onboarding.invite.body')}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            data-testid="onboarding-invite-accept"
            className="h-11 bg-brand text-brand-foreground hover:bg-brand-hover md:h-9"
            onClick={accept}
          >
            {t('onboarding.invite.accept')}
          </Button>
          <Button
            type="button"
            variant="outline"
            data-testid="onboarding-invite-decline"
            className="h-11 md:h-9"
            onClick={decline}
          >
            {t('onboarding.invite.decline')}
          </Button>
          <Link
            to="/how-it-works"
            data-testid="onboarding-invite-how-it-works-link"
            className="px-1 text-sm underline underline-offset-4"
          >
            {t('onboarding.invite.howItWorks')}
          </Link>
        </div>
        <p className="text-muted-foreground text-xs">{t('onboarding.invite.hint')}</p>
      </CardContent>
    </Card>
  )
}
