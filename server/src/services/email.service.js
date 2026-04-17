import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn('[email] SMTP not configured (SMTP_HOST/SMTP_USER/SMTP_PASS missing). Emails will be logged to console only.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return transporter;
}

/**
 * Send an email. Falls back to console.log if SMTP is not configured.
 */
export async function sendEmail({ to, subject, html, text }) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@fusheng.app';
  const t = getTransporter();

  if (!t) {
    // Fallback: log to console (useful for development/testing)
    console.log('═══════════════════════════════════════');
    console.log(`[email] TO: ${to}`);
    console.log(`[email] SUBJECT: ${subject}`);
    console.log(`[email] BODY: ${text || html}`);
    console.log('═══════════════════════════════════════');
    return { messageId: 'console-fallback', logged: true };
  }

  try {
    const result = await t.sendMail({ from, to, subject, html, text });
    console.log(`[email] Sent to ${to}: ${result.messageId}`);
    return result;
  } catch (err) {
    console.error(`[email] Failed to send to ${to}:`, err.message);
    throw err;
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email, resetToken, clientUrl) {
  const resetLink = `${clientUrl}/reset-password?token=${resetToken}`;

  return sendEmail({
    to: email,
    subject: '【富盛典藏】密碼重設',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #4f46e5; margin-bottom: 16px;">富盛典藏 — 密碼重設</h2>
        <p>您好，</p>
        <p>我們收到您的密碼重設請求。請點擊以下連結重設密碼：</p>
        <p style="margin: 24px 0;">
          <a href="${resetLink}"
             style="background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">
            重設密碼
          </a>
        </p>
        <p style="color: #6b7280; font-size: 14px;">
          或複製以下連結到瀏覽器：<br/>
          <code style="background: #f3f4f6; padding: 4px 8px; border-radius: 4px; word-break: break-all;">${resetLink}</code>
        </p>
        <p style="color: #6b7280; font-size: 14px;">此連結將在 1 小時後失效。如果您沒有要求重設密碼，請忽略此信。</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">富盛典藏 — 還款記帳系統</p>
      </div>
    `,
    text: `富盛典藏 — 密碼重設\n\n請點擊以下連結重設密碼：\n${resetLink}\n\n此連結將在 1 小時後失效。`,
  });
}

/**
 * Send notification email (for overdue, review, etc.)
 */
export async function sendNotificationEmail(email, title, message) {
  return sendEmail({
    to: email,
    subject: `【富盛典藏】${title}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #4f46e5; margin-bottom: 16px;">${title}</h2>
        <p>${message}</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">富盛典藏 — 還款記帳系統</p>
      </div>
    `,
    text: `${title}\n\n${message}`,
  });
}
