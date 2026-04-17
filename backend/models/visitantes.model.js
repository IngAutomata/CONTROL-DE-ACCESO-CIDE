const pool = require("../config/database");

async function findByDocumentoForUpdate(client, documento) {
  return client.query(
    `
    SELECT id, documento, nombre, celular, placa, entidad, is_active, created_at, updated_at
    FROM visitantes
    WHERE UPPER(TRIM(documento)) = UPPER(TRIM($1))
    LIMIT 1
    FOR UPDATE
    `,
    [documento]
  );
}

async function findByDocumento(db = pool, documento) {
  return db.query(
    `
    SELECT id, documento, nombre, celular, placa, entidad, is_active, created_at, updated_at
    FROM visitantes
    WHERE UPPER(TRIM(documento)) = UPPER(TRIM($1))
    LIMIT 1
    `,
    [documento]
  );
}

async function findByPlacaForUpdate(client, placa) {
  return client.query(
    `
    SELECT id, documento, nombre, celular, placa, entidad, is_active, created_at, updated_at
    FROM visitantes
    WHERE placa IS NOT NULL
      AND UPPER(TRIM(placa)) = UPPER(TRIM($1))
    LIMIT 1
    FOR UPDATE
    `,
    [placa]
  );
}

async function createVisitante(client, payload) {
  return client.query(
    `
    INSERT INTO visitantes (documento, nombre, celular, placa, entidad)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, documento, nombre, celular, placa, entidad, is_active, created_at, updated_at
    `,
    [payload.documento, payload.nombre, payload.celular, payload.placa || null, payload.entidad || null]
  );
}

async function updateVisitante(client, id, payload) {
  return client.query(
    `
    UPDATE visitantes
    SET nombre = $2,
        celular = $3,
        placa = $4,
        entidad = $5,
        updated_at = NOW()
    WHERE id = $1
    RETURNING id, documento, nombre, celular, placa, entidad, is_active, created_at, updated_at
    `,
    [id, payload.nombre, payload.celular, payload.placa || null, payload.entidad || null]
  );
}

async function listVisitantes(db = pool) {
  return db.query(
    `
    SELECT id, documento, nombre, celular, placa, entidad, is_active, created_at, updated_at
    FROM visitantes
    ORDER BY created_at DESC, id DESC
    `
  );
}

module.exports = {
  createVisitante,
  findByDocumento,
  findByDocumentoForUpdate,
  findByPlacaForUpdate,
  listVisitantes,
  updateVisitante,
};