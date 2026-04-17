const pool = require("../config/database");

const SOLICITUD_ESTADOS = {
  PENDIENTE: "PENDIENTE",
  APROBADA: "APROBADA",
  RECHAZADA: "RECHAZADA",
  EXPIRADA: "EXPIRADA",
};

function buildSelect() {
  return `
    SELECT
      s.id,
      s.documento,
      s.qr_uid,
      s.nombre,
      s.carrera,
      s.correo_institucional,
      s.celular,
      s.placa,
      s.color,
      s.placa_secundaria,
      s.color_secundaria,
      s.qr_imagen_url,
      s.tarjeta_propiedad_principal_url,
      s.tarjeta_propiedad_secundaria_url,
      s.autoriza_tratamiento_datos,
      s.estado,
      s.motivo_rechazo,
      s.notas_revision,
      s.reviewed_by_user_id,
      reviewer.username AS reviewed_by_username,
      s.reviewed_at,
      s.expires_at,
      s.created_at,
      s.updated_at
    FROM solicitudes_inscripcion s
    LEFT JOIN usuarios reviewer ON reviewer.id = s.reviewed_by_user_id
  `;
}

async function expirePending(db = pool) {
  return db.query(
    `
    UPDATE solicitudes_inscripcion
    SET estado = $1,
        motivo_rechazo = COALESCE(motivo_rechazo, 'Solicitud expirada por falta de revisión en 48 horas.'),
        reviewed_at = COALESCE(reviewed_at, NOW()),
        updated_at = NOW()
    WHERE estado = $2
      AND expires_at <= NOW()
    RETURNING *
    `,
    [SOLICITUD_ESTADOS.EXPIRADA, SOLICITUD_ESTADOS.PENDIENTE]
  );
}

async function findPendingConflict(db = pool, { documento, qr_uid, correo_institucional }) {
  return db.query(
    `
    ${buildSelect()}
    WHERE s.estado = $1
      AND (
        s.documento = $2
        OR s.qr_uid = $3
        OR LOWER(s.correo_institucional) = LOWER($4)
      )
    ORDER BY s.id DESC
    LIMIT 1
    `,
    [SOLICITUD_ESTADOS.PENDIENTE, documento, qr_uid, correo_institucional]
  );
}

async function createSolicitud(client, payload) {
  return client.query(
    `
    INSERT INTO solicitudes_inscripcion (
      documento,
      qr_uid,
      nombre,
      carrera,
      correo_institucional,
      celular,
      placa,
      color,
      placa_secundaria,
      color_secundaria,
      qr_imagen_url,
      tarjeta_propiedad_principal_url,
      tarjeta_propiedad_secundaria_url,
      autoriza_tratamiento_datos
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
    )
    RETURNING id
    `,
    [
      payload.documento,
      payload.qr_uid,
      payload.nombre,
      payload.carrera,
      payload.correo_institucional,
      payload.celular,
      payload.placa,
      payload.color,
      payload.placa_secundaria || null,
      payload.color_secundaria || null,
      payload.qr_imagen_url,
      payload.tarjeta_propiedad_principal_url,
      payload.tarjeta_propiedad_secundaria_url || null,
      payload.autoriza_tratamiento_datos,
    ]
  );
}

async function findById(db = pool, id, { forUpdate = false } = {}) {
  return db.query(
    `
    ${buildSelect()}
    WHERE s.id = $1
    ${forUpdate ? "FOR UPDATE OF s" : ""}
    `,
    [id]
  );
}

async function listSolicitudes(db = pool, { estado = null } = {}) {
  const values = [];
  let where = "";

  if (estado) {
    values.push(estado);
    where = "WHERE s.estado = $1";
  }

  return db.query(
    `
    ${buildSelect()}
    ${where}
    ORDER BY s.created_at DESC, s.id DESC
    `,
    values
  );
}

async function markApproved(client, id, { reviewedByUserId, notasRevision = null }) {
  return client.query(
    `
    UPDATE solicitudes_inscripcion
    SET estado = $1,
        motivo_rechazo = NULL,
        notas_revision = $2,
        reviewed_by_user_id = $3,
        reviewed_at = NOW(),
        updated_at = NOW()
    WHERE id = $4
    RETURNING id
    `,
    [SOLICITUD_ESTADOS.APROBADA, notasRevision, reviewedByUserId, id]
  );
}

async function markRejected(client, id, { reviewedByUserId, motivoRechazo, notasRevision = null, estado = SOLICITUD_ESTADOS.RECHAZADA }) {
  return client.query(
    `
    UPDATE solicitudes_inscripcion
    SET estado = $1,
        motivo_rechazo = $2,
        notas_revision = $3,
        reviewed_by_user_id = $4,
        reviewed_at = NOW(),
        updated_at = NOW()
    WHERE id = $5
    RETURNING id
    `,
    [estado, motivoRechazo, notasRevision, reviewedByUserId, id]
  );
}

module.exports = {
  SOLICITUD_ESTADOS,
  createSolicitud,
  expirePending,
  findById,
  findPendingConflict,
  listSolicitudes,
  markApproved,
  markRejected,
};
