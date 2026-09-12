import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

import {
  APP_BASE_URL,
  BUG_REPORT_TO_EMAIL,
  SES_ACCESS_KEY_ID,
  SES_FROM_EMAIL,
  SES_REGION,
  SES_SECRET_ACCESS_KEY,
} from '../../config'
import type { Locale } from '../../lib/locale'

import type { BugReportNotice, PasswordResetNotice } from './notifications.schema'
import { BugReportNoticeSchema, PasswordResetNoticeSchema } from './notifications.schema'

// The password-reset email's inline symbol (#231): a base64 copy of
// docs/design/logo/png/kumite-mark-dark-128.png (the variant meant for the
// charcoal/chrome header). Generated once with
//   python3 -c "import base64;print(base64.b64encode(open('docs/design/logo/png/kumite-mark-dark-128.png','rb').read()).decode())"
// and committed here because back/Dockerfile only copies `back/` and
// `blocks/` into the production image — `docs/` never reaches runtime.
// notifications.test.ts checks this string still matches the PNG on disk, so
// a regenerated logo without a matching update here fails the suite. Kept in
// this file rather than its own (kata/schema-file-naming, ADR-0018 forbids
// ad-hoc file names inside a domain module).
export const KUMITE_MARK_DARK_128_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAABmJLR0QA/wD/AP+gvaeTAAAETElEQVR4nO3dP28cRRjH8WeW6Hze9dl3KazTlZACZCkNrwKSklhUKAU9pAG/BEPj0Kew0kVJFxHxJtJYshQk054sF7Gdu12fLbhBEx9QQLjbPzO3m+f7qXd2x9rfPc+MtxgRAAAAAAAAAAAAAAAAAAAANJ7x/YDDra1W+4/LXRG5LyK9nMNPRWR/8sHKztbh4ZWnKap2w/cD2tPJjyLmm4LDXWAetKeTSES+rXhq8F0Bhp8O4os0PhGRpOSt0tUk2xy8HGYVTQ0z7pflzWQcf17By3eS2b3QpBZgI9kWW829ppHcE5FnEpi1tjV6c7Zr8q1hTq3Ifme9u2OMuarzc00Dyv9fsqQVb/YPDlIJaHR+uldi/fFTZ6NXaOzo/PShiBRdOz3sbPQeLLUFTMbxnQpfvhNnl9lnEt5XRQcaka/tcBjnHefGuLEh5uwtAPa6ZFdq1gZCu1l0oBVJxnH+tYsb48aGmHPkq/yLlcoXbcbK3ePbt6usKv6Zaf7QRnbby1z+61ENKf/LbgMlmLvHx8dJrvLv4ccTNAA+yv+S20AZcdJuLxzacRzfKVn+lxsAX+VfTRuIbNCAm0D/0w+tsm8Io3O3tS4tSy8uN/v9fjqv/KfJ6kkVFaCz0TOVVoD275c/uP/LN+Dl//MN4XrOjWkD48DlP18LMMX3w0tTpzmbBdpA4PL/9pEh9sNLdLMpuwEbePUf7HMw/hYnqyvj0blbnvzbWN7Dr4GoPwKgHAFQjgAoRwCUIwDKEQDlCIByBEA5AqAcAVCOAChHAJQjAMoRAOUIgHIEQDkCoBwBUI4AKEcAlCMAyhEA5QiAcgRAOQKgHAFQjgAoRwCUIwDKEQDlCIByBEA5AqAcAVCOAChHAJQjAMoRAOUIgHIEQDkCoBwBUI4AKEcAlCMAyhEA5QiAcgRAOQKgHAFQjgAoRwCUW8apYVnSijf7Bwfpu46evUjjE0+HT2PZFcBYef6ul+8MXg4za+RnqY/X0jyvaxsAa8zTeddEU5l7TUCPpXke1zUAWdJa/WXeRe217IWI/O9By6GsrXe/tyJ7swOp686ddL3n5lz56eG/fXyr9CnaxsqTD389+nKRa48+ufXEWNku+8yPXh0t/DeWUeXJ32VOIM8rqlv5r2kbmMsMBpkV63HtYp9X/fJDB2Ch8l/HNrAwGz1t2r2juqz+G7AbmGsty14YP6HN0slk4R9PXSvAs7wDaAN+y3/eAJTZD6ezkp5LBW0g/B7eeijVHlvL4gGwJfbDxj5yJT3vsLdjjH1U+Lll5lyfNuCt/OcKwOTGittb5t0Pu2v3JlH7u2LTE5mNLfbc6zk3fDdgvZV/J8geWZvR2dkXYmw1Zduae51uN/f6aVF8DaxxG3D3cPcSjwiAtzYgxdcuM+4e7l7iES3AE2tta/TmbNeI3BeRXoH/6e931rs7xpgrT1MEAAAAAAAAAAAAAAAAAADA++JP4o5mk6JC0UYAAAAASUVORK5CYII='

// pt/es/en copy for the password-reset email (#231). The product name is
// always lowercase `kumite`, even mid-sentence (identity.md §8); "PUCRS ×
// Mérida 2026" stays out of this table since it's a proper name, identical
// in all three languages. Kept in this file for the same ADR-0018 reason as
// the symbol above — notifications.locales.test.ts covers it independently.
type PasswordResetEmailCopy = {
  subject: string
  htmlLang: string
  heading: string
  intro: string
  otpExpiry: string
  cta: string
  fallbackIntro: string
  ignoreNotice: string
  textTitle: string
  textCodeLine: string
  textLinkLine: string
}

export const passwordResetEmailCopy: Record<Locale, PasswordResetEmailCopy> = {
  pt: {
    subject: 'Código de redefinição de senha — kumite',
    htmlLang: 'pt-BR',
    heading: 'Redefinição de senha',
    intro: 'Recebemos um pedido para redefinir a sua senha. Use o código abaixo para concluir.',
    otpExpiry: 'O código expira em 15 minutos.',
    cta: 'Redefinir minha senha',
    fallbackIntro: 'Se o botão não funcionar, copie e cole este endereço no navegador:',
    ignoreNotice: 'Se não foi você quem pediu, ignore este e-mail — sua senha continua a mesma.',
    textTitle: 'Redefinição de senha — kumite',
    textCodeLine: 'Seu código de redefinição de senha é',
    textLinkLine: 'Informe esse código junto com sua nova senha em',
  },
  es: {
    subject: 'Código para restablecer tu contraseña — kumite',
    htmlLang: 'es',
    heading: 'Restablecimiento de contraseña',
    intro:
      'Recibimos una solicitud para restablecer tu contraseña. Usa el código de abajo para completarla.',
    otpExpiry: 'El código vence en 15 minutos.',
    cta: 'Restablecer mi contraseña',
    fallbackIntro: 'Si el botón no funciona, copia y pega esta dirección en el navegador:',
    ignoreNotice: 'Si no fuiste tú quien lo pidió, ignora este correo — tu contraseña sigue igual.',
    textTitle: 'Restablecimiento de contraseña — kumite',
    textCodeLine: 'Tu código para restablecer la contraseña es',
    textLinkLine: 'Ingresa ese código junto con tu nueva contraseña en',
  },
  en: {
    subject: 'Password reset code — kumite',
    htmlLang: 'en',
    heading: 'Password reset',
    intro: 'We received a request to reset your password. Use the code below to finish.',
    otpExpiry: 'The code expires in 15 minutes.',
    cta: 'Reset my password',
    fallbackIntro: "If the button doesn't work, copy and paste this address into your browser:",
    ignoreNotice: "If you didn't ask for this, ignore this email — your password stays the same.",
    textTitle: 'Password reset — kumite',
    textCodeLine: 'Your password reset code is',
    textLinkLine: 'Enter that code together with your new password at',
  },
}

// Both bodies of the password-reset email (#162, redressed in the kumite
// identity by #231). Email clients strip <style> blocks and external
// stylesheets, so every rule is inline and the layout is a <table> — the
// only thing rendered consistently across Gmail, Outlook and Apple Mail.
// The symbol is a base64 `<img>` (clients block remote images by default,
// so it can't be a URL) and the wordmark is plain text right next to it —
// the lockup still reads as "kumite" with the image stripped or blocked.
//
// `baseUrl` is a parameter rather than a direct read of APP_BASE_URL so the
// function stays pure and testable with and without a trailing slash.
export function renderPasswordResetEmail({
  otp,
  baseUrl,
  locale,
}: {
  otp: string
  baseUrl: string
  locale?: Locale
}): {
  html: string
  text: string
} {
  const resetUrl = `${baseUrl.replace(/\/+$/, '')}/reset-password`
  const copy = passwordResetEmailCopy[locale ?? 'pt']

  // The code is a single run of digits on purpose: the spacing is drawn by
  // letter-spacing, so copying it out of the email yields "482917", never
  // "4 8 2 9 1 7".
  const html = `<!doctype html>
<html lang="${copy.htmlLang}">
  <body style="margin: 0; padding: 0; background-color: #FCFAF7; font-family: 'Barlow', 'Inter', system-ui, sans-serif; color: #1C1716;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FCFAF7; padding: 32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 480px; background-color: #FFFFFF; border: 1px solid #E1DDDA; border-radius: 12px; overflow: hidden;">
            <tr>
              <td style="background-color: #1C1716; padding: 20px 32px;">
                <img src="data:image/png;base64,${KUMITE_MARK_DARK_128_BASE64}" width="24" height="24" alt="kumite" style="vertical-align: middle; margin-right: 8px;" />
                <span style="color: #F3F1EF; font-size: 20px; font-weight: 700; letter-spacing: 1px; font-family: 'Barlow Condensed', 'Arial Narrow', 'Roboto Condensed', sans-serif; vertical-align: middle;">kumite</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 32px;">
                <h1 style="margin: 0 0 12px; font-size: 20px; font-weight: 600; color: #1C1716;">${copy.heading}</h1>
                <p style="margin: 0 0 24px; font-size: 15px; line-height: 22px; color: #69615D;">
                  ${copy.intro}
                </p>
                <div style="margin: 0 0 12px; padding: 20px; background-color: #F2F0EC; border: 1px solid #E1DDDA; border-radius: 8px; text-align: center; font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 30px; font-weight: 700; letter-spacing: 8px; color: #1C1716;">${otp}</div>
                <p style="margin: 0 0 28px; font-size: 13px; line-height: 20px; color: #69615D; text-align: center;">
                  ${copy.otpExpiry}
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center">
                      <a href="${resetUrl}" style="display: inline-block; padding: 12px 28px; background-color: #DD2824; color: #FFFFFF; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px;">${copy.cta}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin: 24px 0 0; font-size: 13px; line-height: 20px; color: #69615D;">
                  ${copy.fallbackIntro}<br />
                  <a href="${resetUrl}" style="color: #DD2824;">${resetUrl}</a>
                </p>
                <p style="margin: 24px 0 0; font-size: 13px; line-height: 20px; color: #69615D;">
                  ${copy.ignoreNotice}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding: 20px 32px; border-top: 1px solid #E1DDDA; font-size: 12px; color: #69615D; text-align: center;">
                PUCRS × Mérida 2026
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  const text = [
    copy.textTitle,
    '',
    `${copy.textCodeLine} ${otp}.`,
    `${copy.textLinkLine} ${resetUrl}`,
    copy.otpExpiry,
    '',
    copy.ignoreNotice,
    '',
    'PUCRS × Mérida 2026',
  ].join('\n')

  return { html, text }
}

// Real SES send when SES_REGION/SES_ACCESS_KEY_ID/SES_SECRET_ACCESS_KEY are
// all configured; otherwise falls back to console.log — this is what local
// dev and CI's hurl job run with (no AWS secrets available there, and
// .github/workflows/ is protected, so this can't be worked around in CI).
export async function sendPasswordResetNotice(notice: PasswordResetNotice): Promise<void> {
  const { email, otp, locale } = PasswordResetNoticeSchema.parse(notice)

  if (!SES_REGION || !SES_ACCESS_KEY_ID || !SES_SECRET_ACCESS_KEY) {
    console.log(`[notifications] password reset OTP for ${email}: ${otp}`)
    return
  }

  const client = new SESClient({
    region: SES_REGION,
    credentials: { accessKeyId: SES_ACCESS_KEY_ID, secretAccessKey: SES_SECRET_ACCESS_KEY },
  })

  const { html, text } = renderPasswordResetEmail({ otp, baseUrl: APP_BASE_URL, locale })

  await client.send(
    new SendEmailCommand({
      Source: SES_FROM_EMAIL,
      Destination: { ToAddresses: [email] },
      Message: {
        // Charset is explicit on all three: without it SES assumes 7-bit
        // ASCII and every accented word ("Código", "redefinição") arrives
        // mangled.
        Subject: { Data: passwordResetEmailCopy[locale ?? 'pt'].subject, Charset: 'UTF-8' },
        Body: {
          Text: { Data: text, Charset: 'UTF-8' },
          Html: { Data: html, Charset: 'UTF-8' },
        },
      },
    }),
  )
}

// --- In-app bug reports (#145) ---

// The password-reset email interpolates an OTP this server generated; a bug
// report interpolates whatever a participant typed into a public form. Every
// client-supplied string therefore goes through here before touching the
// HTML body — the description, the user agent, even the route.
function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/**
 * The absolute URL for a reported route, or `null` when the value cannot be
 * trusted as one of ours.
 *
 * Only a single-slash-prefixed path qualifies: `javascript:alert(1)` and
 * `https://phishing.example.com` are still shown in the email as inert text,
 * but they never become a link the organizer might click. `//evil.example`
 * is rejected for the same reason — it is protocol-relative, not a path.
 */
function absoluteRouteUrl(route: string | undefined, baseUrl: string): string | null {
  if (!route || !route.startsWith('/') || route.startsWith('//')) return null
  return `${baseUrl.replace(/\/+$/, '')}${route}`
}

/**
 * Both bodies of the bug-report email, in the visual language of
 * `renderPasswordResetEmail` (#162): inline styles, `<table>` layout, no
 * `<img>`, no `<style>`. Written in pt — the only reader is the organization.
 *
 * Pure: `baseUrl` is a parameter rather than a direct read of APP_BASE_URL.
 */
export function renderBugReportEmail({
  notice,
  baseUrl,
}: {
  notice: BugReportNotice
  baseUrl: string
}): { html: string; text: string } {
  const { description, replyTo, ip, context } = notice
  const routeUrl = absoluteRouteUrl(context?.route, baseUrl)

  // Rendered in this order in both bodies; anything the client left out is
  // dropped rather than shown as an empty row.
  const contextRows = (
    [
      ['Rota', context?.route],
      ['Quando', context?.occurredAt],
      ['E-mail da sessão', context?.userEmail],
      ['ID do usuário', context?.userId],
      ['Navegador', context?.userAgent],
      ['Responder para', replyTo],
      ['IP de origem', ip],
    ] satisfies Array<[string, string | undefined]>
  ).filter((row): row is [string, string] => row[1] !== undefined && row[1] !== '')

  const contextHtmlRows = contextRows
    .map(
      ([label, value]) => `<tr>
                    <td style="padding: 6px 12px 6px 0; font-size: 13px; color: #737373; vertical-align: top; white-space: nowrap;">${escapeHtml(label)}</td>
                    <td style="padding: 6px 0; font-size: 13px; color: #171717; word-break: break-word;">${escapeHtml(value)}</td>
                  </tr>`,
    )
    .join('\n')

  const contextHtml =
    contextRows.length === 0
      ? `<p style="margin: 0; font-size: 13px; color: #737373;">O cliente não enviou nenhum contexto.</p>`
      : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${contextHtmlRows}
                </table>`

  const linkHtml = routeUrl
    ? `<p style="margin: 20px 0 0; font-size: 13px; line-height: 20px; color: #737373;">
                  Abrir a página onde aconteceu:<br />
                  <a href="${escapeHtml(routeUrl)}" style="color: #171717;">${escapeHtml(routeUrl)}</a>
                </p>`
    : ''

  const html = `<!doctype html>
<html lang="pt-BR">
  <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #171717;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5; padding: 32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; background-color: #ffffff; border: 1px solid #e5e5e5; border-radius: 12px; overflow: hidden;">
            <tr>
              <td style="background-color: #171717; padding: 20px 32px;">
                <span style="color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: 1px;">kumite</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 32px;">
                <h1 style="margin: 0 0 12px; font-size: 20px; font-weight: 600; color: #171717;">Novo bug report</h1>
                <p style="margin: 0 0 24px; font-size: 15px; line-height: 22px; color: #525252;">
                  Alguém relatou um problema pelo formulário do app.
                </p>
                <div style="margin: 0 0 28px; padding: 20px; background-color: #f5f5f5; border: 1px solid #e5e5e5; border-radius: 8px; font-size: 15px; line-height: 22px; color: #171717; white-space: pre-wrap; word-break: break-word;">${escapeHtml(description)}</div>
                <h2 style="margin: 0 0 4px; font-size: 14px; font-weight: 600; color: #171717;">Contexto informado pelo cliente</h2>
                <p style="margin: 0 0 12px; font-size: 12px; line-height: 18px; color: #a3a3a3;">
                  Enviado pelo navegador de quem relatou, não verificado pelo servidor.
                </p>
                ${contextHtml}${linkHtml}
              </td>
            </tr>
            <tr>
              <td style="padding: 20px 32px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #a3a3a3; text-align: center;">
                Liga de Algoritmos — PUCRS
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  const text = [
    'Novo bug report — Kumite',
    '',
    'Relato:',
    description,
    '',
    'Contexto informado pelo cliente (não verificado pelo servidor):',
    ...(contextRows.length === 0
      ? ['(o cliente não enviou nenhum contexto)']
      : contextRows.map(([label, value]) => `- ${label}: ${value}`)),
    ...(routeUrl ? ['', `Abrir a página onde aconteceu: ${routeUrl}`] : []),
    '',
    'Liga de Algoritmos — PUCRS',
  ].join('\n')

  return { html, text }
}

/**
 * Delivers a bug report to `BUG_REPORT_TO_EMAIL`. Same shape as
 * `sendPasswordResetNotice`: real SES when the three credentials are all
 * configured, console.log otherwise (local dev, CI's hurl job).
 *
 * Rejects when the send fails — unlike the password-reset flow, the caller
 * (bug-reports.service) turns that into a visible 502 rather than swallowing
 * it, so nobody believes a report was filed when it never left the process.
 */
export async function sendBugReportNotice(notice: BugReportNotice): Promise<void> {
  const parsed = BugReportNoticeSchema.parse(notice)

  if (!SES_REGION || !SES_ACCESS_KEY_ID || !SES_SECRET_ACCESS_KEY) {
    const { text } = renderBugReportEmail({ notice: parsed, baseUrl: APP_BASE_URL })
    console.log(`[notifications] bug report (SES not configured):\n${text}`)
    return
  }

  const client = new SESClient({
    region: SES_REGION,
    credentials: { accessKeyId: SES_ACCESS_KEY_ID, secretAccessKey: SES_SECRET_ACCESS_KEY },
  })

  const { html, text } = renderBugReportEmail({ notice: parsed, baseUrl: APP_BASE_URL })

  await client.send(
    new SendEmailCommand({
      Source: SES_FROM_EMAIL,
      Destination: { ToAddresses: [BUG_REPORT_TO_EMAIL] },
      // Only set when the reporter left an address — SES rejects an empty
      // array, and "responder" is the whole point of the optional field.
      ...(parsed.replyTo ? { ReplyToAddresses: [parsed.replyTo] } : {}),
      Message: {
        Subject: { Data: 'Bug report — Kumite', Charset: 'UTF-8' },
        Body: {
          Text: { Data: text, Charset: 'UTF-8' },
          Html: { Data: html, Charset: 'UTF-8' },
        },
      },
    }),
  )
}
