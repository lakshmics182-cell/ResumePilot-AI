/*
 * Registration confirmation email.
 *
 * Two ways to send, chosen by what is set in backend/.env:
 *
 *   1) Gmail / any SMTP server  (works on your own computer and on paid hosts)
 *        SMTP_USER=yourname@gmail.com
 *        SMTP_PASS=<16-character Google App Password>
 *        (optional) SMTP_HOST=smtp.gmail.com   SMTP_PORT=465
 *
 *   2) Brevo email API over HTTPS  (works on hosts that block SMTP ports,
 *      such as Render's free plan)
 *        BREVO_API_KEY=<your Brevo API key>
 *        MAIL_FROM_EMAIL=<a sender address verified in Brevo>
 *
 * Common settings:
 *        MAIL_FROM_NAME=ResumePilot AI
 *        FRONTEND_URL=https://your-site.example   (link inside the email)
 *
 * If nothing is configured, no email is sent and the app works normally.
 * A failed email never blocks registration.
 */

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function emailProvider() {
  if (process.env.BREVO_API_KEY) {
    return "brevo";
  }

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    return "smtp";
  }

  return null;
}

function senderDetails() {
  const name = process.env.MAIL_FROM_NAME || "ResumePilot AI";
  const email =
    process.env.MAIL_FROM_EMAIL || process.env.SMTP_USER || "";

  return { name, email };
}

function buildWelcomeEmail({ name }) {
  const siteUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const safeName = escapeHtml(name);

  const text = [
    `Hi ${name},`,
    "",
    "Welcome to ResumePilot AI. Your account has been created successfully.",
    "",
    "You can now:",
    "- Build a resume with the AI interview (text or voice)",
    "- Upload a resume and compare it with a job description",
    "- Create a cover letter, optimise your LinkedIn profile, practise mock interviews and build a portfolio",
    "",
    `Log in here: ${siteUrl}`,
    "",
    "If you did not create this account, you can ignore this email.",
    "",
    "- The ResumePilot AI team",
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f4f2fb;font-family:Arial,Helvetica,sans-serif;color:#2b2840;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;padding:32px;">
      <div style="width:48px;height:48px;border-radius:12px;background:#6c4df6;color:#ffffff;font-size:24px;font-weight:bold;text-align:center;line-height:48px;">R</div>
      <h2 style="margin:20px 0 8px;">Welcome to ResumePilot AI, ${safeName}!</h2>
      <p style="margin:0 0 16px;line-height:1.6;">Your account has been created successfully. You can now:</p>
      <ul style="margin:0 0 20px;padding-left:20px;line-height:1.7;">
        <li>Build a resume with the AI interview (text or voice)</li>
        <li>Upload a resume and compare it with a job description</li>
        <li>Create a cover letter, optimise your LinkedIn profile, practise mock interviews and build a portfolio</li>
      </ul>
      <p style="margin:0 0 24px;">
        <a href="${escapeHtml(siteUrl)}" style="display:inline-block;background:#6c4df6;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:bold;">Log in to ResumePilot AI</a>
      </p>
      <p style="margin:0;color:#7a7590;font-size:13px;line-height:1.5;">If you did not create this account, you can safely ignore this email.</p>
    </div>
  </body>
</html>`;

  return {
    subject: "Welcome to ResumePilot AI - your registration is confirmed",
    text,
    html,
  };
}

async function sendWithBrevo({ to, toName, subject, text, html }) {
  const sender = senderDetails();

  if (!sender.email) {
    throw new Error("MAIL_FROM_EMAIL is not set");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(
      process.env.BREVO_API_URL || "https://api.brevo.com/v3/smtp/email",
      {
        method: "POST",
        headers: {
          "api-key": process.env.BREVO_API_KEY,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          sender: { name: sender.name, email: sender.email },
          to: [{ email: to, name: toName }],
          subject,
          htmlContent: html,
          textContent: text,
        }),
      }
    );

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 200);
      throw new Error(`Brevo returned ${response.status}: ${detail}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

async function sendWithSmtp({ to, subject, text, html }) {
  let nodemailer;

  try {
    nodemailer = require("nodemailer");
  } catch {
    throw new Error(
      'The "nodemailer" package is not installed. Run: npm install nodemailer'
    );
  }

  const port = Number(process.env.SMTP_PORT || 465);
  const sender = senderDetails();

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });

  await transporter.sendMail({
    from: `"${sender.name.replace(/"/g, "")}" <${sender.email}>`,
    to,
    subject,
    text,
    html,
  });
}

async function sendWelcomeEmail(user) {
  const provider = emailProvider();

  if (!provider || !user || !user.email) {
    return false;
  }

  const message = {
    to: user.email,
    toName: user.name,
    ...buildWelcomeEmail({ name: user.name }),
  };

  if (provider === "brevo") {
    await sendWithBrevo(message);
  } else {
    await sendWithSmtp(message);
  }

  return true;
}

module.exports = {
  emailProvider,
  sendWelcomeEmail,
  buildWelcomeEmail,
};
