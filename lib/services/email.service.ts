/**
 * Transactional Email Service via Brevo Free Tier (300 emails/day)
 *
 * Implements:
 * - Verification emails with 30-minute single-use secure tokens.
 * - Password reset emails with 30-minute single-use secure tokens.
 * - Graceful local development fallback (logs links when BREVO_API_KEY is not set).
 * - Apple dark-styled responsive email templates.
 */

import { getAppUrl } from "../utils/app-url";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export class EmailService {
  /**
   * Sends transactional email using Brevo's v3 SMTP REST API.
   */
  private static async sendViaBrevo(params: SendEmailParams): Promise<boolean> {
    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_SENDER_EMAIL;
    const senderName = process.env.BREVO_SENDER_NAME || "TrackIt";

    // If Brevo is not configured (e.g. initial setup / development), log for convenience
    if (!apiKey) {
      console.warn(
        `[EmailService:DEV_MODE] BREVO_API_KEY not configured. Simulated email to: ${params.to}`
      );
      console.log(`[EmailService:DEV_MODE] Subject: ${params.subject}`);
      console.log(`[EmailService:DEV_MODE] Text: ${params.text}`);
      return true;
    }

    // Brevo only delivers from a sender address verified in the Brevo dashboard
    // (Senders, Domains & Dedicated IPs). There is no safe default to fall back to.
    if (!senderEmail) {
      console.error("[EmailService] BREVO_SENDER_EMAIL is not configured; cannot send email.");
      return false;
    }

    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: params.to }],
          subject: params.subject,
          htmlContent: params.html,
          textContent: params.text,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`Brevo API Error (${response.status}) sending "${params.subject}":`, errorBody);
        return false;
      }

      return true;
    } catch (err) {
      console.error("Failed to transmit email via Brevo:", err);
      return false;
    }
  }

  /**
   * Sends the email verification message containing a 30-minute single-use link.
   */
  static async sendVerificationEmail(to: string, token: string): Promise<boolean> {
    const appUrl = getAppUrl();
    const verificationUrl = `${appUrl}/verify-email?token=${token}`;

    const subject = "Verify your TrackIt account";
    const text = `Welcome to TrackIt!\n\nPlease verify your email address by visiting this link (expires in 30 minutes):\n${verificationUrl}\n\nIf you did not sign up for TrackIt, please ignore this email.`;

    const html = `
      <!DOCTYPE html>
      <html>
      <body style="background-color: #000000; color: #f5f5f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 40px 20px;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px; background-color: #121215; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 32px;">
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <h1 style="color: #ffffff; font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.5px;">TrackIt</h1>
              <p style="color: #8e8e93; font-size: 13px; margin-top: 4px;">Private movie & TV series tracker</p>
            </td>
          </tr>
          <tr>
            <td style="color: #f5f5f7; font-size: 14px; line-height: 1.6; padding-bottom: 24px;">
              <p style="margin: 0 0 16px 0;">Welcome! Tap the button below to verify your email address. This link is valid for <strong>30 minutes</strong>.</p>
              <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 24px auto;">
                <tr>
                  <td align="center" style="background-color: #0a84ff; border-radius: 12px;">
                    <a href="${verificationUrl}" target="_blank" style="display: inline-block; padding: 12px 28px; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 12px;">
                      Verify Email Address
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color: #8e8e93; font-size: 12px; margin: 0;">If you did not create a TrackIt account, you can safely ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 16px; color: #636366; font-size: 11px; text-align: center;">
              Unverified accounts are automatically deleted after 7 days.
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    return this.sendViaBrevo({ to, subject, html, text });
  }

  /**
   * Sends the password reset message containing a 30-minute single-use link.
   */
  static async sendPasswordResetEmail(to: string, token: string): Promise<boolean> {
    const appUrl = getAppUrl();
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    const subject = "Reset your TrackIt password";
    const text = `A password reset was requested for your TrackIt account.\n\nClick this link to set a new password (expires in 30 minutes):\n${resetUrl}\n\nIf you did not request this, you can ignore this email. You can also always reset your password using your one-time recovery backup codes.`;

    const html = `
      <!DOCTYPE html>
      <html>
      <body style="background-color: #000000; color: #f5f5f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 40px 20px;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px; background-color: #121215; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 32px;">
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <h1 style="color: #ffffff; font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.5px;">TrackIt</h1>
              <p style="color: #8e8e93; font-size: 13px; margin-top: 4px;">Password Reset Request</p>
            </td>
          </tr>
          <tr>
            <td style="color: #f5f5f7; font-size: 14px; line-height: 1.6; padding-bottom: 24px;">
              <p style="margin: 0 0 16px 0;">We received a request to reset your password. Tap below to choose a new password. This link expires in <strong>30 minutes</strong>.</p>
              <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 24px auto;">
                <tr>
                  <td align="center" style="background-color: #0a84ff; border-radius: 12px;">
                    <a href="${resetUrl}" target="_blank" style="display: inline-block; padding: 12px 28px; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 12px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color: #8e8e93; font-size: 12px; margin: 0;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
            </td>
          </tr>
          <tr>
            <td style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 16px; color: #636366; font-size: 11px; text-align: center;">
              Tip: You can also reset your password at any time using your one-time recovery codes.
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    return this.sendViaBrevo({ to, subject, html, text });
  }
}

