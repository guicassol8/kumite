import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

import { AWS_ACCESS_KEY_ID, AWS_REGION, AWS_SECRET_ACCESS_KEY, SES_FROM_EMAIL } from '../../config'

import type { PasswordResetNotice } from './notifications.schema'
import { PasswordResetNoticeSchema } from './notifications.schema'

// Real SES send when AWS_REGION/AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY are
// all configured; otherwise falls back to console.log — this is what local
// dev and CI's hurl job run with (no AWS secrets available there, and
// .github/workflows/ is protected, so this can't be worked around in CI).
export async function sendPasswordResetNotice(notice: PasswordResetNotice): Promise<void> {
  const { email, otp } = PasswordResetNoticeSchema.parse(notice)

  if (!AWS_REGION || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    console.log(`[notifications] password reset OTP for ${email}: ${otp}`)
    return
  }

  const client = new SESClient({
    region: AWS_REGION,
    credentials: { accessKeyId: AWS_ACCESS_KEY_ID, secretAccessKey: AWS_SECRET_ACCESS_KEY },
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
