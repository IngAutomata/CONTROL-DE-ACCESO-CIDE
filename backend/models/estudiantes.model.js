const pool = require("../config/database");

async function upsertPrimerIngreso(client, payload) {
  const { documento, qr_uid, nombre, carrera, vigencia, placa, color } = payload;

  const estudianteResult = await client.query(
    `
    INSERT INTO estudiantes (documento, qr_uid, nombre, carrera, vigencia)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (documento)
    DO UPDATE SET qr_uid = EXCLUDED.qr_uid, nombre = EXCLUDED.nombre, carrera = EXCLUDED.carrera, vigencia = EXCLUDED.vigencia
    RETURNING id, documento, qr_uid, nombre, carrera, vigencia
    `,
    [documento, qr_uid, nombre, carrera, vigencia]
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

  return estudiante;
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
      m.placa,
      m.color
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
      m.placa,
      m.color
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
      m.placa,
      m.color
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
