const pool = require("../config/database");

async function upsertPrimerIngreso(client, payload, actorUserId = null) {
  const { documento, qr_uid, nombre, carrera, vigencia, placa, color } = payload;
  const existingEstudianteResult = await client.query(
    "SELECT id FROM estudiantes WHERE documento = $1 LIMIT 1",
    [documento]
  );
  const existingMotoResult = existingEstudianteResult.rows.length
    ? await client.query("SELECT id FROM motocicletas WHERE estudiante_id = $1 LIMIT 1", [existingEstudianteResult.rows[0].id])
    : { rows: [] };
  const estudianteWasCreated = existingEstudianteResult.rows.length === 0;
  const motoWasCreated = existingMotoResult.rows.length === 0;

  const estudianteResult = await client.query(
    `
    INSERT INTO estudiantes (documento, qr_uid, nombre, carrera, vigencia, created_by, updated_by)
    VALUES ($1, $2, $3, $4, $5, $6, $6)
    ON CONFLICT (documento)
    DO UPDATE SET
      qr_uid = EXCLUDED.qr_uid,
      nombre = EXCLUDED.nombre,
      carrera = EXCLUDED.carrera,
      vigencia = EXCLUDED.vigencia,
      updated_at = NOW(),
      updated_by = EXCLUDED.updated_by
    RETURNING id, documento, qr_uid, nombre, carrera, vigencia, created_at, updated_at, created_by, updated_by
    `,
    [documento, qr_uid, nombre, carrera, vigencia, actorUserId]
  );

  const estudiante = estudianteResult.rows[0];

  await client.query(
    `
    INSERT INTO motocicletas (estudiante_id, placa, color, created_by, updated_by)
    VALUES ($1, $2, $3, $4, $4)
    ON CONFLICT (estudiante_id)
    DO UPDATE SET
      placa = EXCLUDED.placa,
      color = EXCLUDED.color,
      updated_at = NOW(),
      updated_by = EXCLUDED.updated_by
    `,
    [estudiante.id, placa, color, actorUserId]
  );

  return {
    estudiante,
    estudianteWasCreated,
    motoWasCreated,
  };
}

async function findByDocumento(documento) {
  return pool.query(
    `
    SELECT
      e.id AS estudiante_id,
      e.documento,
      e.qr_uid,
      e.nombre,
      e.carrera,
      e.vigencia,
      e.created_at,
      e.updated_at,
      e.created_by,
      e.updated_by,
      m.placa,
      m.color,
      m.created_at AS moto_created_at,
      m.updated_at AS moto_updated_at,
      m.created_by AS moto_created_by,
      m.updated_by AS moto_updated_by
    FROM estudiantes e
    LEFT JOIN motocicletas m ON m.estudiante_id = e.id
    WHERE e.documento = $1
    `,
    [documento]
  );
}

async function findById(id) {
  return pool.query(
    `
    SELECT
      e.id AS estudiante_id,
      e.documento,
      e.qr_uid,
      e.nombre,
      e.carrera,
      e.vigencia,
      e.created_at,
      e.updated_at,
      e.created_by,
      e.updated_by,
      m.placa,
      m.color,
      m.created_at AS moto_created_at,
      m.updated_at AS moto_updated_at,
      m.created_by AS moto_created_by,
      m.updated_by AS moto_updated_by
    FROM estudiantes e
    LEFT JOIN motocicletas m ON m.estudiante_id = e.id
    WHERE e.id = $1
    `,
    [id]
  );
}

async function listAll() {
  return pool.query(
    `
    SELECT
      e.id AS estudiante_id,
      e.documento,
      e.qr_uid,
      e.nombre,
      e.carrera,
      e.vigencia,
      e.created_at,
      e.updated_at,
      e.created_by,
      e.updated_by,
      m.placa,
      m.color,
      m.created_at AS moto_created_at,
      m.updated_at AS moto_updated_at,
      m.created_by AS moto_created_by,
      m.updated_by AS moto_updated_by
    FROM estudiantes e
    LEFT JOIN motocicletas m ON m.estudiante_id = e.id
    ORDER BY e.id DESC
    `
  );
}

async function findByQrUidForUpdate(client, qrUid) {
  return client.query(
    "SELECT id, documento, qr_uid, nombre, carrera, vigencia FROM estudiantes WHERE qr_uid = $1 FOR UPDATE",
    [qrUid]
  );
}

module.exports = {
  upsertPrimerIngreso,
  findByDocumento,
  findById,
  listAll,
  findByQrUidForUpdate,
};
