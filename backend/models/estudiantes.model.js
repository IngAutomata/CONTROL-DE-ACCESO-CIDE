const pool = require("../config/database");
const { getAuditCapabilities } = require("./audit-capabilities.model");

const MOTO_TIPOS = {
  PRINCIPAL: "PRINCIPAL",
  SECUNDARIA: "SECUNDARIA",
};

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
      moto_principal.placa AS placa,
      moto_principal.color AS color,
      moto_secundaria.placa AS placa_secundaria,
      moto_secundaria.color AS color_secundaria,
      COALESCE(moto_list.motos, '[]'::json) AS motos
    FROM estudiantes e
    LEFT JOIN LATERAL (
      SELECT m.placa, m.color
      FROM motocicletas m
      WHERE m.estudiante_id = e.id
        AND m.is_active = TRUE
        AND m.tipo = '${MOTO_TIPOS.PRINCIPAL}'
      ORDER BY m.id DESC
      LIMIT 1
    ) moto_principal ON TRUE
    LEFT JOIN LATERAL (
      SELECT m.placa, m.color
      FROM motocicletas m
      WHERE m.estudiante_id = e.id
        AND m.is_active = TRUE
        AND m.tipo = '${MOTO_TIPOS.SECUNDARIA}'
      ORDER BY m.id DESC
      LIMIT 1
    ) moto_secundaria ON TRUE
    LEFT JOIN LATERAL (
      SELECT json_agg(
        json_build_object(
          'id', m.id,
          'tipo', m.tipo,
          'placa', m.placa,
          'color', m.color,
          'is_active', m.is_active,
          'created_at', m.created_at,
          'updated_at', m.updated_at
        )
        ORDER BY CASE m.tipo WHEN '${MOTO_TIPOS.PRINCIPAL}' THEN 0 ELSE 1 END, m.id
      ) AS motos
      FROM motocicletas m
      WHERE m.estudiante_id = e.id
        AND m.is_active = TRUE
    ) moto_list ON TRUE
    ${createdByJoin}
    ${updatedByJoin}
  `;
}

function getMotoPayload(payload = {}, tipo = MOTO_TIPOS.PRINCIPAL) {
  if (tipo === MOTO_TIPOS.PRINCIPAL) {
    return {
      placa: payload.placa || null,
      color: payload.color || null,
    };
  }

  return {
    placa: payload.placa_secundaria || null,
    color: payload.color_secundaria || null,
  };
}

async function upsertMotoByTipo(client, estudianteId, tipo, motoPayload = {}) {
  const { placa, color } = motoPayload;

  if (!placa || !color) {
    return { rows: [] };
  }

  const existing = await client.query(
    `
    SELECT id
    FROM motocicletas
    WHERE estudiante_id = $1
      AND tipo = $2
      AND is_active = TRUE
    LIMIT 1
    FOR UPDATE
    `,
    [estudianteId, tipo]
  );

  if (existing.rows.length > 0) {
    return client.query(
      `
      UPDATE motocicletas
      SET placa = $1,
          color = $2,
          updated_at = NOW(),
          is_active = TRUE
      WHERE id = $3
      RETURNING id
      `,
      [placa, color, existing.rows[0].id]
    );
  }

  return client.query(
    `
    INSERT INTO motocicletas (estudiante_id, placa, color, tipo)
    VALUES ($1, $2, $3, $4)
    RETURNING id
    `,
    [estudianteId, placa, color, tipo]
  );
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
  const {
    documento,
    qr_uid,
    nombre,
    carrera,
    celular = null,
    vigencia,
  } = payload;
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

  await upsertMotoByTipo(client, estudiante.id, MOTO_TIPOS.PRINCIPAL, getMotoPayload(payload, MOTO_TIPOS.PRINCIPAL));
  await upsertMotoByTipo(client, estudiante.id, MOTO_TIPOS.SECUNDARIA, getMotoPayload(payload, MOTO_TIPOS.SECUNDARIA));

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
    WHERE UPPER(moto_lookup.placa) = UPPER($1)
      AND moto_lookup.is_active = TRUE
      AND e.is_deleted = FALSE
    LIMIT 1
    `,
    [placa]
  );
}

async function findById(id) {
  return findByIdWithDb(pool, id);
}

async function updateById(client, id, payload, audit = {}) {
  const {
    documento,
    qr_uid,
    nombre,
    carrera,
    celular = null,
    vigencia,
  } = payload;
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

  await upsertMotoByTipo(client, id, MOTO_TIPOS.PRINCIPAL, getMotoPayload(payload, MOTO_TIPOS.PRINCIPAL));

  if (Object.prototype.hasOwnProperty.call(payload, "placa_secundaria") || Object.prototype.hasOwnProperty.call(payload, "color_secundaria")) {
    await upsertMotoByTipo(client, id, MOTO_TIPOS.SECUNDARIA, getMotoPayload(payload, MOTO_TIPOS.SECUNDARIA));
  }

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
  const capabilities = await getAuditCapabilities(client);
  return client.query(
    `
    ${buildStudentSelect(capabilities)}
    WHERE e.documento = $1 AND e.is_deleted = FALSE
    FOR UPDATE OF e
    `,
    [documento]
  );
}

async function findByPlacaForUpdate(client, placa) {
  const capabilities = await getAuditCapabilities(client);
  return client.query(
    `
    ${buildStudentSelect(capabilities)}
    JOIN motocicletas m ON m.estudiante_id = e.id
    WHERE UPPER(m.placa) = UPPER($1)
      AND m.is_active = TRUE
      AND e.is_deleted = FALSE
    LIMIT 1
    FOR UPDATE OF e
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
  MOTO_TIPOS,
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
