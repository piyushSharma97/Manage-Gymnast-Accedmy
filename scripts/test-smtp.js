/* Simple SMTP test script.
   Usage: node scripts/test-smtp.js
   It loads environment variables from .env and attempts to send a test email.
*/
require('dotenv').config();
const nodemailer = require('nodemailer');

const host = process.env.SMTP_HOST;
const port = Number(process.env.SMTP_PORT) || 587;
const secureSetting = process.env.SMTP_SECURE || '';
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const from = process.env.SMTP_FROM || user;
const to = process.env.TEST_EMAIL || process.env.SMTP_FROM || user;

function parseSecure(setting, port) {
  const s = String(setting).toLowerCase();
  if (s === 'tls' || s === 'starttls') return { secure: false, requireTLS: true };
  if (s === 'ssl' || s === 'true' || s === '1' || s === 'yes') return { secure: true, requireTLS: false };
  if (s === 'false' || s === '0' || s === 'no') return { secure: false, requireTLS: false };
  // default based on port
  if (port === 465) return { secure: true, requireTLS: false };
  if (port === 587) return { secure: false, requireTLS: true };
  return { secure: false, requireTLS: false };
}

async function main() {
  if (!host || !user || !pass || !from) {
    console.error('Missing SMTP configuration. Please populate SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM in .env');
    process.exit(1);
  }

  const { secure, requireTLS } = parseSecure(secureSetting, port);

  console.log('SMTP test using:', { host, port, secure, requireTLS, from, to });

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject: 'SMTP test — My Academy',
      text: 'This is a test email sent by scripts/test-smtp.js',
      html: '<p>This is a test email sent by <b>scripts/test-smtp.js</b></p>',
    });

    console.log('Message sent:', info.messageId || info.response || info);
    // Close transporter if possible
    if (transporter.close) transporter.close();
    process.exit(0);
  } catch (err) {
    console.error('Failed to send test email:', err);
    if (err && err.code) console.error('Error code:', err.code);
    process.exit(2);
  }
}

main();
