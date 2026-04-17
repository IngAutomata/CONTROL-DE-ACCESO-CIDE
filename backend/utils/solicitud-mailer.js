const { sendMailSafe } = require("./mailer");

const SUBJECT_PREFIX = "INFORMACIÓN SIUC Sistema de Ingreso CIDE";

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildLayout({ title, intro, lines }) {
  const lineItems = lines
    .filter(Boolean)
    .map((line) => `<li style="margin:0 0 8px;">${escapeHtml(line)}</li>`)
    .join("");

  return `
    <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.5;color:#173b36;max-width:640px;">
      <h2 style="margin:0 0 12px;color:#0f4d45;">${escapeHtml(title)}</h2>
      <p style="margin:0 0 16px;">${escapeHtml(intro)}</p>
      <ul style="padding-left:18px;margin:0 0 16px;">${lineItems}</ul>
      <p style="margin:16px 0 0;">Sistema institucional SIUC - Universidad CIDE</p>
    </div>
  `;
}

function createSubmissionMail(solicitud) {
  return {
    to: solicitud.correo_institucional,
    subject: `RECEPCIÓN - ${SUBJECT_PREFIX}`,
    text: [
      `Hola ${solicitud.nombre},`,
      "Recibimos tu solicitud de inscripción en SIUC.",
      `Documento: ${solicitud.documento}`,
      `Estado actual: ${solicitud.estado || "PENDIENTE"}`,
      "La administración revisará la información y responderá a este mismo correo.",
      "Si en 48 horas no es aprobada o rechazada, la solicitud expirará automáticamente.",
    ].join("\n"),
    html: buildLayout({
      title: "Solicitud de inscripción recibida",
      intro: `Hola ${solicitud.nombre}, recibimos correctamente tu solicitud en SIUC.`,
      lines: [
        `Documento: ${solicitud.documento}`,
        `Estado actual: ${solicitud.estado || "PENDIENTE"}`,
        "La administración revisará tus datos y responderá a este mismo correo.",
        "Si en 48 horas no se aprueba o rechaza, la solicitud expirará automáticamente.",
      ],
    }),
  };
}

function createApprovalMail(solicitud) {
  return {
    to: solicitud.correo_institucional,
    subject: `ACEPTACIÓN - ${SUBJECT_PREFIX}`,
    text: [
      `Hola ${solicitud.nombre},`,
      "Tu solicitud de inscripción fue aprobada.",
      `Documento: ${solicitud.documento}`,
      "Ya puedes continuar con tu proceso de ingreso institucional en SIUC.",
      solicitud.notas_revision ? `Notas de revisión: ${solicitud.notas_revision}` : null,
    ].filter(Boolean).join("\n"),
    html: buildLayout({
      title: "Solicitud aprobada",
      intro: `Hola ${solicitud.nombre}, tu solicitud de inscripción fue aprobada.`,
      lines: [
        `Documento: ${solicitud.documento}`,
        "Tu registro ya fue aceptado por la administración.",
        solicitud.notas_revision ? `Notas de revisión: ${solicitud.notas_revision}` : null,
      ],
    }),
  };
}

function createRejectionMail(solicitud) {
  return {
    to: solicitud.correo_institucional,
    subject: `RECHAZO - ${SUBJECT_PREFIX}`,
    text: [
      `Hola ${solicitud.nombre},`,
      "Tu solicitud de inscripción fue rechazada.",
      `Documento: ${solicitud.documento}`,
      solicitud.motivo_rechazo ? `Motivo: ${solicitud.motivo_rechazo}` : null,
      solicitud.notas_revision ? `Notas de revisión: ${solicitud.notas_revision}` : null,
      "Corrige la información y registra una nueva solicitud.",
    ].filter(Boolean).join("\n"),
    html: buildLayout({
      title: "Solicitud rechazada",
      intro: `Hola ${solicitud.nombre}, tu solicitud de inscripción fue rechazada.`,
      lines: [
        `Documento: ${solicitud.documento}`,
        solicitud.motivo_rechazo ? `Motivo: ${solicitud.motivo_rechazo}` : null,
        solicitud.notas_revision ? `Notas de revisión: ${solicitud.notas_revision}` : null,
        "Corrige la información y registra una nueva solicitud.",
      ],
    }),
  };
}

function createExpiredMail(solicitud) {
  return {
    to: solicitud.correo_institucional,
    subject: `RECHAZO - ${SUBJECT_PREFIX}`,
    text: [
      `Hola ${solicitud.nombre},`,
      "Tu solicitud de inscripción expiró porque no fue aprobada ni rechazada dentro del plazo de 48 horas.",
      `Documento: ${solicitud.documento}`,
      "Debes registrar una nueva solicitud para continuar con el proceso.",
    ].join("\n"),
    html: buildLayout({
      title: "Solicitud expirada",
      intro: `Hola ${solicitud.nombre}, tu solicitud expiró por falta de revisión dentro del plazo establecido.`,
      lines: [
        `Documento: ${solicitud.documento}`,
        "Debes registrar una nueva solicitud para continuar con el proceso.",
      ],
    }),
  };
}

async function notifySolicitudCreada(solicitud) {
  return sendMailSafe(createSubmissionMail(solicitud));
}

async function notifySolicitudAprobada(solicitud) {
  return sendMailSafe(createApprovalMail(solicitud));
}

async function notifySolicitudRechazada(solicitud) {
  return sendMailSafe(createRejectionMail(solicitud));
}

async function notifySolicitudExpirada(solicitud) {
  return sendMailSafe(createExpiredMail(solicitud));
}

module.exports = {
  notifySolicitudAprobada,
  notifySolicitudCreada,
  notifySolicitudExpirada,
  notifySolicitudRechazada,
};