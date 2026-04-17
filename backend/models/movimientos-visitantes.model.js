const pool = require("../config/database");

async function getLastByVisitanteId(client, visitanteId) {
  return client.query(
    `
    SELECT id, visitante_id, tipo, motivo_visita, persona_visitada, observaciones, vehiculo_placa, actor_user_id, fecha AS fecha_hora
    FROM movimientos_visitantes
    WHERE visitante_id = $1
    ORDER BY fecha DESC, id DESC
    LIMIT 1
    `,
    [visitanteId]
  );
}

async function createMovimientoVisitante(client, visitanteId, tipo, payload = {}) {
  return client.query(
    `
    INSERT INTO movimientos_visitantes (visitante_id, tipo, motivo_visita, persona_visitada, observaciones, vehiculo_placa, actor_user_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, visitante_id, tipo, motivo_visita, persona_visitada, observaciones, vehiculo_placa, actor_user_id, fecha AS fecha_hora
    `,
    [
      visitanteId,
      tipo,
      payload.motivoVisita || null,
      payload.personaVisitada || null,
      payload.observaciones || null,
      payload.vehiculoPlaca || null,
      payload.actorUserId || null,
    ]
  );
}

async function listAllMovimientosVisitantes(db = pool) {
  return db.query(
    `
    SELECT
      mv.id,
      mv.visitante_id,
      v.documento,
      v.nombre,
      v.celular,
      v.entidad,
      mv.tipo,
      mv.motivo_visita,
      mv.persona_visitada,
      mv.observaciones,
      mv.vehiculo_placa AS placa,
      mv.actor_user_id,
      actor.username AS actor_username,
      mv.fecha AS fecha_hora
    FROM movimientos_visitantes mv
    JOIN visitantes v ON v.id = mv.visitante_id
    LEFT JOIN usuarios actor ON actor.id = mv.actor_user_id
    ORDER BY mv.fecha DESC, mv.id DESC
    `
  );
}

async function listDentroCampusVisitantes(db = pool) {
  return db.query(
    `
    WITH ultimo_movimiento AS (
      SELECT DISTINCT ON (mv.visitante_id)
        mv.id,
        mv.visitante_id,
        mv.tipo,
        mv.motivo_visita,
        mv.persona_visitada,
        mv.observaciones,
        mv.vehiculo_placa,
        mv.actor_user_id,
        mv.fecha
      FROM movimientos_visitantes mv
      ORDER BY mv.visitante_id, mv.fecha DESC, mv.id DESC
    )
    SELECT
      v.id AS visitante_id,
      v.documento,
      v.nombre,
      v.celular,
      v.entidad,
      COALESCE(um.vehiculo_placa, v.placa) AS placa,
      um.motivo_visita,
      um.persona_visitada,
      um.observaciones,
      um.tipo AS ultimo_movimiento,
      um.actor_user_id,
      actor.username AS actor_username,
      um.fecha AS fecha_ultimo_movimiento
    FROM ultimo_movimiento um
    JOIN visitantes v ON v.id = um.visitante_id
    LEFT JOIN usuarios actor ON actor.id = um.actor_user_id
    WHERE um.tipo = 'ENTRADA'
    ORDER BY um.fecha DESC, um.id DESC
    `
  );
}

async function findCurrentInsideByPlateForUpdate(client, placa) {
  return client.query(
    `
    WITH ultimo_movimiento AS (
      SELECT DISTINCT ON (mv.visitante_id)
        mv.id,
        mv.visitante_id,
        mv.tipo,
        mv.motivo_visita,
        mv.persona_visitada,
        mv.observaciones,
        mv.vehiculo_placa,
        mv.actor_user_id,
        mv.fecha
      FROM movimientos_visitantes mv
      ORDER BY mv.visitante_id, mv.fecha DESC, mv.id DESC
    )
    SELECT
      v.id,
      v.documento,
      v.nombre,
      v.celular,
      v.placa,
      v.entidad,
      um.vehiculo_placa AS placa_movimiento_actual,
      um.motivo_visita,
      um.persona_visitada,
      um.observaciones,
      um.fecha AS fecha_ultimo_movimiento
    FROM ultimo_movimiento um
    JOIN visitantes v ON v.id = um.visitante_id
    WHERE um.tipo = 'ENTRADA'
      AND UPPER(TRIM(COALESCE(um.vehiculo_placa, v.placa))) = UPPER(TRIM($1))
    LIMIT 1
    FOR UPDATE OF v
    `,
    [placa]
  );
}

module.exports = {
  createMovimientoVisitante,
  findCurrentInsideByPlateForUpdate,
  getLastByVisitanteId,
  listAllMovimientosVisitantes,
  listDentroCampusVisitantes,
};