import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

import {
  APP_BASE_URL,
  SES_ACCESS_KEY_ID,
  SES_FROM_EMAIL,
  SES_REGION,
  SES_SECRET_ACCESS_KEY,
} from '../../config'

import type { PasswordResetNotice } from './notifications.schema'
import { PasswordResetNoticeSchema } from './notifications.schema'

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
