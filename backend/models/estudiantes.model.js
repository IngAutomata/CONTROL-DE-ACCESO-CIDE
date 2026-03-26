const pool = require("../config/database");

async function createPrimerIngreso(client, payload) {
  const { documento, qr_uid, nombre, carrera, vigencia, placa, color } = payload;

  const estudianteResult = await client.query(
    `
    INSERT INTO estudiantes (documento, qr_uid, nombre, carrera, vigencia)
    VALUES ($1, $2, $3, $4, $5)
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

async function findByPlaca(placa) {
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
    JOIN motocicletas m ON m.estudiante_id = e.id
    WHERE UPPER(m.placa) = UPPER($1)
    LIMIT 1
    `,
    [placa]
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

async function updateById(client, id, payload) {
  const { documento, qr_uid, nombre, carrera, vigencia, placa, color } = payload;

  const estudianteResult = await client.query(
    `
    UPDATE estudiantes
    SET documento = $1, qr_uid = $2, nombre = $3, carrera = $4, vigencia = $5
    WHERE id = $6
    RETURNING id, documento, qr_uid, nombre, carrera, vigencia
    `,
    [documento, qr_uid, nombre, carrera, vigencia, id]
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

  return estudianteResult;
}

async function deleteById(client, id) {
  return client.query(
    `
    DELETE FROM estudiantes
    WHERE id = $1
    RETURNING id, documento, qr_uid, nombre, carrera, vigencia
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
  createPrimerIngreso,
  findByDocumento,
  findByPlaca,
  findById,
  listAll,
  findByQrUidForUpdate,
  updateById,
  deleteById,
};
