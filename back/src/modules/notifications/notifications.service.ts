import type { PasswordResetNotice } from './notifications.schema'
import { PasswordResetNoticeSchema } from './notifications.schema'

// Stub: console-logs the notice instead of sending a real email. Seam for a
// future real email/OTP-delivery issue (signup confirmation will reuse it).
export async function sendPasswordResetNotice(notice: PasswordResetNotice): Promise<void> {
  const { email, temporaryPassword } = PasswordResetNoticeSchema.parse(notice)
  console.log(`[notifications] password reset for ${email}: ${temporaryPassword}`)
}
