import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

import {
  APP_BASE_URL,
  BUG_REPORT_TO_EMAIL,
  SES_ACCESS_KEY_ID,
  SES_FROM_EMAIL,
  SES_REGION,
  SES_SECRET_ACCESS_KEY,
} from '../../config'

import type { BugReportNotice, PasswordResetNotice } from './notifications.schema'
import { BugReportNoticeSchema, PasswordResetNoticeSchema } from './notifications.schema'

// Both bodies of the password-reset email (#162). Email clients strip <style>
// blocks and external stylesheets, so every rule is inline and the layout is
// a <table> — the only thing rendered consistently across Gmail, Outlook and
// Apple Mail. No <img>: clients block remote images by default, so the visual
// identity has to survive on CSS alone.
//
// `baseUrl` is a parameter rather than a direct read of APP_BASE_URL so the
// function stays pure and testable with and without a trailing slash.
export function renderPasswordResetEmail({ otp, baseUrl }: { otp: string; baseUrl: string }): {
  html: string
  text: string
} {
  const resetUrl = `${baseUrl.replace(/\/+$/, '')}/reset-password`

  // The code is a single run of digits on purpose: the spacing is drawn by
  // letter-spacing, so copying it out of the email yields "482917", never
  // "4 8 2 9 1 7".
  const html = `<!doctype html>
<html lang="pt-BR">
  <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #171717;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5; padding: 32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 480px; background-color: #ffffff; border: 1px solid #e5e5e5; border-radius: 12px; overflow: hidden;">
            <tr>
              <td style="background-color: #171717; padding: 20px 32px;">
                <span style="color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: 1px;">kumite</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 32px;">
                <h1 style="margin: 0 0 12px; font-size: 20px; font-weight: 600; color: #171717;">Redefinição de senha</h1>
                <p style="margin: 0 0 24px; font-size: 15px; line-height: 22px; color: #525252;">
                  Recebemos um pedido para redefinir a sua senha. Use o código abaixo para concluir.
                </p>
                <div style="margin: 0 0 12px; padding: 20px; background-color: #f5f5f5; border: 1px solid #e5e5e5; border-radius: 8px; text-align: center; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 30px; font-weight: 700; letter-spacing: 8px; color: #171717;">${otp}</div>
                <p style="margin: 0 0 28px; font-size: 13px; line-height: 20px; color: #737373; text-align: center;">
                  O código expira em 15 minutos.
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center">
                      <a href="${resetUrl}" style="display: inline-block; padding: 12px 28px; background-color: #171717; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px;">Redefinir minha senha</a>
                    </td>
                  </tr>
                </table>
                <p style="margin: 24px 0 0; font-size: 13px; line-height: 20px; color: #737373;">
                  Se o botão não funcionar, copie e cole este endereço no navegador:<br />
                  <a href="${resetUrl}" style="color: #171717;">${resetUrl}</a>
                </p>
                <p style="margin: 24px 0 0; font-size: 13px; line-height: 20px; color: #737373;">
                  Se não foi você quem pediu, ignore este e-mail — sua senha continua a mesma.
                </p>
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
    'Redefinição de senha — Kumite',
    '',
    `Seu código de redefinição de senha é ${otp}.`,
    `Informe esse código junto com sua nova senha em ${resetUrl}`,
    'O código expira em 15 minutos.',
    '',
    'Se não foi você quem pediu, ignore este e-mail — sua senha continua a mesma.',
    '',
    'Liga de Algoritmos — PUCRS',
  ].join('\n')

  return { html, text }
}

// Real SES send when SES_REGION/SES_ACCESS_KEY_ID/SES_SECRET_ACCESS_KEY are
// all configured; otherwise falls back to console.log — this is what local
// dev and CI's hurl job run with (no AWS secrets available there, and
// .github/workflows/ is protected, so this can't be worked around in CI).
export async function sendPasswordResetNotice(notice: PasswordResetNotice): Promise<void> {
  const { email, otp } = PasswordResetNoticeSchema.parse(notice)

  if (!SES_REGION || !SES_ACCESS_KEY_ID || !SES_SECRET_ACCESS_KEY) {
    console.log(`[notifications] password reset OTP for ${email}: ${otp}`)
    return
  }

  const client = new SESClient({
    region: SES_REGION,
    credentials: { accessKeyId: SES_ACCESS_KEY_ID, secretAccessKey: SES_SECRET_ACCESS_KEY },
  })

  const { html, text } = renderPasswordResetEmail({ otp, baseUrl: APP_BASE_URL })

  await client.send(
    new SendEmailCommand({
      Source: SES_FROM_EMAIL,
      Destination: { ToAddresses: [email] },
      Message: {
        // Charset is explicit on all three: without it SES assumes 7-bit
        // ASCII and every accented word ("Código", "redefinição") arrives
        // mangled.
        Subject: { Data: 'Código de redefinição de senha — Kumite', Charset: 'UTF-8' },
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
