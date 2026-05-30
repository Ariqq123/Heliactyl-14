/**
 * Email notification service for security events.
 * Sends alerts on password regeneration and account deletion.
 * Configure SMTP in settings.json under "email" key.
 */

const nodemailer = require("nodemailer");
const logger = require("./logger").child({ module: "email" });

let transporter = null;

function getTransporter(settings) {
  if (!settings.email || !settings.email.enabled) return null;
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: settings.email.smtp.host,
    port: settings.email.smtp.port || 587,
    secure: settings.email.smtp.secure || false,
    auth: {
      user: settings.email.smtp.user,
      pass: settings.email.smtp.pass,
    },
  });

  return transporter;
}

/**
 * Send a security notification email.
 * @param {object} settings - App settings with email config
 * @param {string} to - Recipient email
 * @param {string} event - Event type (password_regen, account_deleted)
 * @param {object} data - Additional context { username, ip }
 */
async function sendSecurityEmail(settings, to, event, data = {}) {
  const transport = getTransporter(settings);
  if (!transport) return;

  const templates = {
    password_regen: {
      subject: `[${settings.name}] Password Regenerated`,
      html: `
        <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #1e293b; margin-bottom: 16px;">Password Changed</h2>
          <p style="color: #475569; line-height: 1.6;">Hi <strong>${data.username || "there"}</strong>,</p>
          <p style="color: #475569; line-height: 1.6;">Your panel password was just regenerated on <strong>${settings.name}</strong>.</p>
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px; margin: 20px 0;">
            <p style="color: #991b1b; margin: 0; font-size: 14px;"><strong>If you didn't do this</strong>, someone may have access to your account. Log in immediately and regenerate your password again.</p>
          </div>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">This is an automated security notification from ${settings.name}.</p>
        </div>
      `,
    },
    account_deleted: {
      subject: `[${settings.name}] Account Deleted`,
      html: `
        <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #1e293b; margin-bottom: 16px;">Account Deleted</h2>
          <p style="color: #475569; line-height: 1.6;">Hi <strong>${data.username || "there"}</strong>,</p>
          <p style="color: #475569; line-height: 1.6;">Your account on <strong>${settings.name}</strong> has been permanently deleted.</p>
          <p style="color: #475569; line-height: 1.6;">All coins, resources, and dashboard access have been removed. Your servers on the Pterodactyl panel remain intact.</p>
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px; margin: 20px 0;">
            <p style="color: #991b1b; margin: 0; font-size: 14px;"><strong>If you didn't request this</strong>, please contact an administrator immediately.</p>
          </div>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">This is an automated security notification from ${settings.name}.</p>
        </div>
      `,
    },
  };

  const template = templates[event];
  if (!template) return;

  try {
    await transport.sendMail({
      from: settings.email.from || `"${settings.name}" <noreply@${settings.email.smtp.host}>`,
      to,
      subject: template.subject,
      html: template.html,
    });
    logger.info({ to, event }, "Security email sent");
  } catch (e) {
    logger.error(e, "Failed to send security email");
  }
}

module.exports = { sendSecurityEmail };
