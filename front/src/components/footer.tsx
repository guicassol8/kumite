import { useTranslation } from 'react-i18next'

// The address itself is never translated — only the label around it.
const CONTACT_EMAIL = 'ligadealgoritmos@gmail.com'

export function Footer() {
  const { t } = useTranslation()

  return (
    <footer data-testid="app-footer" className="mt-auto border-t p-4 text-center">
      <p className="text-muted-foreground text-sm">
        {t('footer.contactLabel')}{' '}
        <a
          data-testid="footer-contact-email"
          href={`mailto:${CONTACT_EMAIL}`}
          className="underline"
        >
          {CONTACT_EMAIL}
        </a>
      </p>
      {/* O gatilho de reportar bug (issue irmã) entra aqui. */}
    </footer>
  )
}
