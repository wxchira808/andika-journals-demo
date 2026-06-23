/**
 * Shared email utility using Nodemailer with cPanel SMTP.
 *
 * Required environment variables:
 *   orders_email_host     — cPanel SMTP host, e.g. mail.andikajournals.com
 *   orders_email_address  — Sender email, e.g. orders@andikajournals.com
 *   orders_email_password — cPanel email password
 *
 * cPanel typically uses port 465 (SSL/TLS). If your host requires STARTTLS, set
 * EMAIL_PORT=587 and EMAIL_SECURE=false in your Vercel env vars.
 */

const nodemailer = require("nodemailer");

function createTransport() {
  const host = process.env.orders_email_host;
  const user = process.env.orders_email_address;
  const pass = process.env.orders_email_password;

  if (!host || !user || !pass) {
    throw new Error("Email is not configured. Set orders_email_host, orders_email_address, and orders_email_password in Vercel.");
  }

  const port = Number(process.env.EMAIL_PORT || 465);
  const secure = process.env.EMAIL_SECURE !== "false"; // default true (SSL)

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });
}

/**
 * Send an email.
 * @param {{ to: string, subject: string, text: string, html: string }} options
 */
async function sendEmail({ to, subject, text, html }) {
  const transporter = createTransport();
  const from = `"Andika Journals" <${process.env.orders_email_address}>`;
  await transporter.sendMail({ from, to, subject, text, html });
}

module.exports = { sendEmail };
