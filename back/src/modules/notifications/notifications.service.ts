import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

import { SES_ACCESS_KEY_ID, SES_FROM_EMAIL, SES_REGION, SES_SECRET_ACCESS_KEY } from '../../config'

import type { PasswordResetNotice } from './notifications.schema'
import { PasswordResetNoticeSchema } from './notifications.schema'

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

  await client.send(
    new SendEmailCommand({
      Source: SES_FROM_EMAIL,
      Destination: { ToAddresses: [email] },
      Message: {
        Subject: { Data: 'Código de redefinição de senha — Kumite' },
        Body: {
          Text: {
            Data: `Seu código de redefinição de senha é ${otp}. Acesse /reset-password no site do Kumite e informe esse código junto com sua nova senha. Ele expira em 15 minutos.`,
          },
        },
      },
    }),
  )
}
