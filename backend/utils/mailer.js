const nodemailer = require("nodemailer");

let transporterPromise = null;

function parseEmailList(value) {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;
  const secure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";
  const cc = parseEmailList(process.env.SMTP_CC);

  if (!host || !port || !from) {
    return null;
  }

  return {
    host,
    port,
    secure,
    from,
    cc,
    auth: user && pass ? { user, pass } : undefined,
  };
}

async function getTransporter() {
  const config = getSmtpConfig();
  if (!config) return null;

  if (!transporterPromise) {
    transporterPromise = Promise.resolve(
      nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: config.auth,
      })
    );
  }

  return transporterPromise;
}

async function sendMail({ to, cc, subject, text, html }) {
  const config = getSmtpConfig();
  const transporter = await getTransporter();

  if (!config || !transporter) {
    console.warn(`[mail] SMTP no configurado. Correo omitido para ${to}: ${subject}`);
    return { skipped: true };
  }

  const combinedCc = [...new Set([...(config.cc || []), ...parseEmailList(cc)])];

  return transporter.sendMail({
    from: config.from,
    to,
    cc: combinedCc.length ? combinedCc : undefined,
    subject,
    text,
    html,
  });
}

async function sendMailSafe(payload) {
  try {
    return await sendMail(payload);
  } catch (error) {
    console.error("[mail] error al enviar correo", error.message);
    return { error: error.message };
  }
}

module.exports = {
  getSmtpConfig,
  parseEmailList,
  sendMail,
  sendMailSafe,
};