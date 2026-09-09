// The suite must never take the real SES branch of notifications.service:
// once the credentials were renamed to SES_* (#156) a developer .env with
// working credentials started matching config.ts, which made the fallback
// test fail and password-reset's tests send real email over the network.
//
// Blanked rather than deleted on purpose: config.ts calls loadEnvFile(),
// which fills in only names absent from process.env — a delete would just be
// undone by back/.env. An empty value is the "explicitly blank counts as
// unset" case config.ts already handles (see optionalNonEmptyString).
process.env.SES_REGION = ''
process.env.SES_ACCESS_KEY_ID = ''
process.env.SES_SECRET_ACCESS_KEY = ''
