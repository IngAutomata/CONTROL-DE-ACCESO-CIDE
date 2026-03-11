const pool = require("../config/database");

async function getLastByEstudianteId(client, estudianteId) {
  return client.query(
    "SELECT tipo FROM movimientos WHERE estudiante_id = $1 ORDER BY fecha DESC, id DESC LIMIT 1",
    [estudianteId]
  );
}

async function createMovimiento(client, estudianteId, tipo) {
  return client.query(
    "INSERT INTO movimientos (estudiante_id, tipo) VALUES ($1, $2) RETURNING id, estudiante_id, tipo, fecha AS fecha_hora",
    [estudianteId, tipo]
  );
}

async function listAllMovimientos() {
  return pool.query(
    `
    SELECT
      m.id,
      m.estudiante_id,
      e.documento,
      e.nombre,
      e.carrera,
      e.vigencia,
      m.tipo,
      m.fecha AS fecha_hora
    FROM movimientos m
    JOIN estudiantes e ON e.id = m.estudiante_id
    ORDER BY m.fecha DESC, m.id DESC
    `
  );
}

async function listMovimientosByEstudianteId(estudianteId) {
  return pool.query(
    `
    SELECT
      m.id,
      m.estudiante_id,
      e.documento,
      e.nombre,
      e.carrera,
      e.vigencia,
      m.tipo,
      m.fecha AS fecha_hora
    FROM movimientos m
    JOIN estudiantes e ON e.id = m.estudiante_id
    WHERE m.estudiante_id = $1
    ORDER BY m.fecha DESC, m.id DESC
    `,
    [estudianteId]
  );
}

async function listDentroCampus() {
  return pool.query(
    `
    WITH ultimo_movimiento AS (
      SELECT DISTINCT ON (m.estudiante_id)
        m.estudiante_id,
        m.tipo,
        m.fecha
      FROM movimientos m
      ORDER BY m.estudiante_id, m.fecha DESC, m.id DESC
    )
    SELECT
      e.id AS estudiante_id,
      e.documento,
      e.nombre,
      e.carrera,
      e.vigencia,
      moto.placa,
      moto.color,
      um.tipo AS ultimo_movimiento,
      um.fecha AS fecha_ultimo_movimiento
    FROM ultimo_movimiento um
    JOIN estudiantes e ON e.id = um.estudiante_id
    LEFT JOIN motocicletas moto ON moto.estudiante_id = e.id
    WHERE um.tipo = 'ENTRADA'
    ORDER BY um.fecha DESC
    `
  );
}

module.exports = {
  getLastByEstudianteId,
  createMovimiento,
  listAllMovimientos,
  listMovimientosByEstudianteId,
  listDentroCampus,
};
