const pool = require("../config/database");
const { getAuditCapabilities } = require("./audit-capabilities.model");

function buildStudentSelect(capabilities = {}) {
  const createdByFields = capabilities.estudianteCreatedBy
    ? `
      e.created_by_user_id,
      creator.username AS created_by_username,
    `
    : `
      NULL::int AS created_by_user_id,
      NULL::varchar AS created_by_username,
    `;
  const updatedByFields = capabilities.estudianteUpdatedBy
    ? `
      e.updated_by_user_id,
      updater.username AS updated_by_username,
    `
    : `
      NULL::int AS updated_by_user_id,
      NULL::varchar AS updated_by_username,
    `;
  const createdByJoin = capabilities.estudianteCreatedBy
    ? "LEFT JOIN usuarios creator ON creator.id = e.created_by_user_id"
    : "";
  const updatedByJoin = capabilities.estudianteUpdatedBy
    ? "LEFT JOIN usuarios updater ON updater.id = e.updated_by_user_id"
    : "";

  return `
    SELECT
      e.id AS estudiante_id,
      e.documento,
      e.qr_uid,
      e.nombre,
      e.carrera,
      e.celular,
      e.vigencia,
      e.is_deleted,
      e.deleted_at,
      e.created_at,
      e.updated_at,
      ${createdByFields}
      ${updatedByFields}
      m.placa,
      m.color
    FROM estudiantes e
    LEFT JOIN motocicletas m ON m.estudiante_id = e.id
    ${createdByJoin}
    ${updatedByJoin}
  `;
}

async function findByIdWithDb(db, id) {
  const capabilities = await getAuditCapabilities(db);
  return db.query(
    `
    ${buildStudentSelect(capabilities)}
    WHERE e.id = $1 AND e.is_deleted = FALSE
    `,
    [id]
  );
}

async function createPrimerIngreso(client, payload, audit = {}) {
  const { documento, qr_uid, nombre, carrera, celular = null, vigencia, placa, color } = payload;
  const { actorUserId = null } = audit;
  const capabilities = await getAuditCapabilities(client);
  const fields = ["documento", "qr_uid", "nombre", "carrera", "celular", "vigencia"];
  const values = [documento, qr_uid, nombre, carrera, celular, vigencia];

  if (capabilities.estudianteCreatedBy) {
    fields.push("created_by_user_id");
    values.push(actorUserId);
  }

  if (capabilities.estudianteUpdatedBy) {
    fields.push("updated_by_user_id");
    values.push(actorUserId);
  }

  const estudianteResult = await client.query(
    `
    INSERT INTO estudiantes (${fields.join(", ")})
    VALUES (${values.map((_, index) => `$${index + 1}`).join(", ")})
    RETURNING id
    `,
    values
  );

  const estudiante = estudianteResult.rows[0];

  await client.query(
    `
    INSERT INTO motocicletas (estudiante_id, placa, color)
    VALUES ($1, $2, $3)
    ON CONFLICT (estudiante_id)
    DO UPDATE SET placa = EXCLUDED.placa, color = EXCLUDED.color
    `,
    [estudiante.id, placa, color]
  );

  const fullStudent = await findByIdWithDb(client, estudiante.id);
  return fullStudent.rows[0];
}

async function findByDocumento(documento) {
  const capabilities = await getAuditCapabilities(pool);
  return pool.query(
    `
    ${buildStudentSelect(capabilities)}
    WHERE e.documento = $1 AND e.is_deleted = FALSE
    `,
    [documento]
  );
}

async function findByPlaca(placa) {
  const capabilities = await getAuditCapabilities(pool);
  return pool.query(
    `
    ${buildStudentSelect(capabilities)}
    JOIN motocicletas moto_lookup ON moto_lookup.estudiante_id = e.id
    WHERE UPPER(moto_lookup.placa) = UPPER($1) AND e.is_deleted = FALSE
    LIMIT 1
    `,
    [placa]
  );
}

async function findById(id) {
  return findByIdWithDb(pool, id);
}

async function updateById(client, id, payload, audit = {}) {
  const { documento, qr_uid, nombre, carrera, celular = null, vigencia, placa, color } = payload;
  const { actorUserId = null } = audit;
  const capabilities = await getAuditCapabilities(client);
  const values = [documento, qr_uid, nombre, carrera, celular, vigencia];
  const assignments = [
    "documento = $1",
    "qr_uid = $2",
    "nombre = $3",
    "carrera = $4",
    "celular = $5",
    "vigencia = $6",
  ];

  if (capabilities.estudianteUpdatedBy) {
    assignments.push(`updated_by_user_id = $${values.length + 1}`);
    values.push(actorUserId);
  }

  values.push(id);

  const estudianteResult = await client.query(
    `
    UPDATE estudiantes
    SET ${assignments.join(", ")}, updated_at = NOW()
    WHERE id = $${values.length}
    RETURNING id
    `,
    values
  );

  if (estudianteResult.rows.length === 0) {
    return { rows: [] };
  }

  await client.query(
    `
    INSERT INTO motocicletas (estudiante_id, placa, color)
    VALUES ($1, $2, $3)
    ON CONFLICT (estudiante_id)
    DO UPDATE SET placa = EXCLUDED.placa, color = EXCLUDED.color
    `,
    [id, placa, color]
  );

  return findByIdWithDb(client, id);
}

async function softDeleteById(client, id) {
  return client.query(
    `
    UPDATE estudiantes
    SET is_deleted = TRUE,
        deleted_at = NOW(),
        updated_at = NOW(),
        vigencia = FALSE
    WHERE id = $1
      AND is_deleted = FALSE
    RETURNING id, documento, qr_uid, nombre, carrera, celular, vigencia, is_deleted, deleted_at, updated_at
    `,
    [id]
  );
}

async function restoreById(client, id) {
  return client.query(
    `
    UPDATE estudiantes
    SET is_deleted = FALSE,
        deleted_at = NULL,
        updated_at = NOW()
    WHERE id = $1
      AND is_deleted = TRUE
    RETURNING id, documento, qr_uid, nombre, carrera, celular, vigencia, is_deleted, deleted_at, updated_at
    `,
    [id]
  );
}

async function listAll() {
  const capabilities = await getAuditCapabilities(pool);
  return pool.query(
    `
    ${buildStudentSelect(capabilities)}
    WHERE e.is_deleted = FALSE
    ORDER BY e.id DESC
    `
  );
}

async function listAllIncludingDeleted() {
  const capabilities = await getAuditCapabilities(pool);
  return pool.query(
    `
    ${buildStudentSelect(capabilities)}
    ORDER BY e.id DESC
    `
  );
}

async function findByQrUidForUpdate(client, qrUid) {
  return client.query(
    "SELECT id, documento, qr_uid, nombre, carrera, celular, vigencia FROM estudiantes WHERE qr_uid = $1 AND is_deleted = FALSE FOR UPDATE",
    [qrUid]
  );
}

async function findByQrCandidatesForUpdate(client, candidates) {
  const filtered = Array.from(new Set((candidates || []).filter(Boolean)));

  if (filtered.length === 0) {
    return { rows: [] };
  }

  return client.query(
    `
    SELECT id, documento, qr_uid, nombre, carrera, celular, vigencia
    FROM estudiantes
    WHERE qr_uid = ANY($1::text[]) AND is_deleted = FALSE
    ORDER BY CASE WHEN qr_uid = $2 THEN 0 ELSE 1 END, id DESC
    FOR UPDATE
    `,
    [filtered, filtered[0]]
  );
}

async function findByDocumentoForUpdate(client, documento) {
  return client.query(
    `
    SELECT id, documento, qr_uid, nombre, carrera, celular, vigencia
    FROM estudiantes
    WHERE documento = $1 AND is_deleted = FALSE
    FOR UPDATE
    `,
    [documento]
  );
}

async function findByPlacaForUpdate(client, placa) {
  return client.query(
    `
    SELECT e.id, e.documento, e.qr_uid, e.nombre, e.carrera, e.celular, e.vigencia
    FROM estudiantes e
    JOIN motocicletas m ON m.estudiante_id = e.id
    WHERE UPPER(m.placa) = UPPER($1) AND e.is_deleted = FALSE
    LIMIT 1
    FOR UPDATE
    `,
    [placa]
  );
}

async function findByCelularForUpdate(client, celular) {
  return client.query(
    `
    SELECT id, documento, qr_uid, nombre, carrera, celular, vigencia
    FROM estudiantes
    WHERE celular = $1 AND is_deleted = FALSE
    LIMIT 1
    FOR UPDATE
    `,
    [celular]
  );
}

module.exports = {
  createPrimerIngreso,
  findByDocumento,
  findByDocumentoForUpdate,
  findByPlaca,
  findByPlacaForUpdate,
  findByCelularForUpdate,
  findById,
  listAll,
  listAllIncludingDeleted,
  findByQrUidForUpdate,
  findByQrCandidatesForUpdate,
  updateById,
  softDeleteById,
  restoreById,
};
