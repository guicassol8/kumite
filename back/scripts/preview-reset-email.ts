// Prints the password-reset email (#162) to stdout so it can be opened in a
// browser — the visual evidence a back-only test run cannot produce:
//
//   pnpm --silent --filter @kumite/back email:preview > /tmp/reset-email.html
//   pnpm --silent --filter @kumite/back email:preview https://kumite.example.com > ...
//   pnpm --silent --filter @kumite/back email:preview http://localhost:3000 482917 es > /tmp/reset-email-es.html
//
// --silent matters when redirecting: without it pnpm's own banner lands on
// stdout ahead of the doctype. The optional second argument overrides the OTP,
// the optional third the locale (#231; pt/es/en, defaults to pt).
//
// config.ts parses the environment at import time and JWT_SECRET is required,
// so a placeholder goes in first: the preview must run with no .env at all.
process.env.JWT_SECRET ??= 'preview'

const { APP_BASE_URL } = await import('../src/config')
const { LocaleSchema } = await import('../src/lib/locale')
const { renderPasswordResetEmail } = await import(
  '../src/modules/notifications/notifications.service'
)

const baseUrl = process.argv[2] ?? APP_BASE_URL
const otp = process.argv[3] ?? '482917'
const locale = LocaleSchema.optional().parse(process.argv[4])

const { html } = renderPasswordResetEmail({ otp, baseUrl, locale })

process.stdout.write(html)
