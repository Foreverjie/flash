import { Resend } from "resend"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

const FROM_EMAIL = process.env.EMAIL_FROM || "noreply@scflash.win"

export async function sendVerificationEmail(email: string, url: string) {
  if (!resend) {
    console.warn("[Email] Resend not configured, logging verification URL")
    console.info(`[Email] Verification URL for ${email}: ${url}`)
    return
  }

  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Verify your email address",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="margin-bottom: 24px;">Verify your email</h2>
        <p style="color: #555; line-height: 1.6;">Click the button below to verify your email address and complete your registration.</p>
        <a href="${url}" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 24px 0;">Verify Email</a>
        <p style="color: #999; font-size: 14px; margin-top: 32px;">If you didn't create an account, you can safely ignore this email.</p>
      </div>
    `,
  })

  console.info(`[Email] Verification email sent to ${email}`)
}

export async function sendPasswordResetEmail(email: string, url: string) {
  if (!resend) {
    console.warn("[Email] Resend not configured, logging reset URL")
    console.info(`[Email] Reset URL for ${email}: ${url}`)
    return
  }

  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Reset your password",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="margin-bottom: 24px;">Reset your password</h2>
        <p style="color: #555; line-height: 1.6;">Click the button below to reset your password.</p>
        <a href="${url}" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 24px 0;">Reset Password</a>
        <p style="color: #999; font-size: 14px; margin-top: 32px;">If you didn't request a password reset, you can safely ignore this email. The link will expire shortly.</p>
      </div>
    `,
  })

  console.info(`[Email] Password reset email sent to ${email}`)
}
