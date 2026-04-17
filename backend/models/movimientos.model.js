const pool = require("../config/database");
const { getAuditCapabilities } = require("./audit-capabilities.model");

async function getLastByEstudianteId(client, estudianteId) {
  return client.query(
    `
    SELECT
      m.tipo,
      COALESCE(na.placa_observada, m.vehiculo_placa) AS vehiculo_placa
    FROM movimientos m
    LEFT JOIN novedades_acceso na ON na.movimiento_id = m.id
    WHERE m.estudiante_id = $1
    ORDER BY m.fecha DESC, m.id DESC
    LIMIT 1
    `,
    [estudianteId]
  );
}

async function createMovimiento(client, estudianteId, tipo, audit = {}) {
  const { actorUserId = null, vehiculoPlaca = null } = audit;
  const capabilities = await getAuditCapabilities(client);

  if (capabilities.movimientoActor) {
    return client.query(
      `
      INSERT INTO movimientos (estudiante_id, tipo, vehiculo_placa, actor_user_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id, estudiante_id, tipo, vehiculo_placa, actor_user_id, fecha AS fecha_hora
      `,
      [estudianteId, tipo, vehiculoPlaca, actorUserId]
    );
  }

  return client.query(
    "INSERT INTO movimientos (estudiante_id, tipo, vehiculo_placa) VALUES ($1, $2, $3) RETURNING id, estudiante_id, tipo, vehiculo_placa, fecha AS fecha_hora",
    [estudianteId, tipo, vehiculoPlaca]
  );
}

function buildActorFields(capabilities = {}) {
  if (!capabilities.movimientoActor) {
    return {
      join: "",
      fields: `
        NULL::int AS actor_user_id,
        NULL::varchar AS actor_username,
      `,
    };
  }

  return {
    join: "LEFT JOIN usuarios actor ON actor.id = m.actor_user_id",
    fields: `
      m.actor_user_id,
      actor.username AS actor_username,
    `,
  };
}

async function listAllMovimientos() {
  const capabilities = await getAuditCapabilities(pool);
  const actorMeta = buildActorFields(capabilities);

  return pool.query(
    `
    SELECT
      m.id,
      m.estudiante_id,
      e.documento,
      e.nombre,
      e.carrera,
      e.vigencia,
      COALESCE(na.placa_observada, m.vehiculo_placa, moto.placa) AS placa,
      na.tipo_novedad,
      na.motivo AS novedad_motivo,
      na.tipo_soporte,
      na.soporte_validado,
      na.observaciones,
      ${actorMeta.fields}
      m.tipo,
      m.fecha AS fecha_hora
    FROM movimientos m
    JOIN estudiantes e ON e.id = m.estudiante_id
    LEFT JOIN novedades_acceso na ON na.movimiento_id = m.id
    LEFT JOIN motocicletas moto ON moto.estudiante_id = e.id AND moto.tipo = 'PRINCIPAL' AND moto.is_active = TRUE
    ${actorMeta.join}
    ORDER BY m.fecha DESC, m.id DESC
    `
  );
}

async function listMovimientosByEstudianteId(estudianteId) {
  const capabilities = await getAuditCapabilities(pool);
  const actorMeta = buildActorFields(capabilities);

  return pool.query(
    `
    SELECT
      m.id,
      m.estudiante_id,
      e.documento,
      e.nombre,
      e.carrera,
      e.vigencia,
      COALESCE(na.placa_observada, m.vehiculo_placa, moto.placa) AS placa,
      na.tipo_novedad,
      na.motivo AS novedad_motivo,
      na.tipo_soporte,
      na.soporte_validado,
      na.observaciones,
      ${actorMeta.fields}
      m.tipo,
      m.fecha AS fecha_hora
    FROM movimientos m
    JOIN estudiantes e ON e.id = m.estudiante_id
    LEFT JOIN novedades_acceso na ON na.movimiento_id = m.id
    LEFT JOIN motocicletas moto ON moto.estudiante_id = e.id AND moto.tipo = 'PRINCIPAL' AND moto.is_active = TRUE
    ${actorMeta.join}
    WHERE m.estudiante_id = $1
    ORDER BY m.fecha DESC, m.id DESC
    `,
    [estudianteId]
  );
}

async function listDentroCampus() {
  const capabilities = await getAuditCapabilities(pool);
  const actorCteField = capabilities.movimientoActor ? "m.actor_user_id," : "";
  const actorJoin = capabilities.movimientoActor
    ? "LEFT JOIN usuarios actor ON actor.id = um.actor_user_id"
    : "";
  const actorSelect = capabilities.movimientoActor
    ? `
      um.actor_user_id,
      actor.username AS actor_username,
    `
    : `
      NULL::int AS actor_user_id,
      NULL::varchar AS actor_username,
    `;

  return pool.query(
    `
    WITH ultimo_movimiento AS (
      SELECT DISTINCT ON (m.estudiante_id)
        m.estudiante_id,
        m.tipo,
        m.vehiculo_placa,
        m.fecha,
        ${actorCteField}
        m.id
      FROM movimientos m
      ORDER BY m.estudiante_id, m.fecha DESC, m.id DESC
    )
    SELECT
      e.id AS estudiante_id,
      e.documento,
      e.nombre,
      e.carrera,
      e.vigencia,
      COALESCE(na.placa_observada, um.vehiculo_placa, moto.placa) AS placa,
      moto.color,
      na.tipo_novedad,
      na.motivo AS novedad_motivo,
      um.tipo AS ultimo_movimiento,
      ${actorSelect}
      um.fecha AS fecha_ultimo_movimiento
    FROM ultimo_movimiento um
    JOIN estudiantes e ON e.id = um.estudiante_id
    LEFT JOIN novedades_acceso na ON na.movimiento_id = um.id
    LEFT JOIN motocicletas moto ON moto.estudiante_id = e.id AND moto.tipo = 'PRINCIPAL' AND moto.is_active = TRUE
    ${actorJoin}
    WHERE um.tipo = 'ENTRADA'
    ORDER BY um.fecha DESC
    `
  );
}

async function findCurrentInsideByPlateForUpdate(client, placa) {
  const capabilities = await getAuditCapabilities(client);
  const actorCteField = capabilities.movimientoActor ? "m.actor_user_id," : "";

  return client.query(
    `
    WITH ultimo_movimiento AS (
      SELECT DISTINCT ON (m.estudiante_id)
        m.estudiante_id,
        m.tipo,
        m.vehiculo_placa,
        m.fecha,
        ${actorCteField}
        m.id
      FROM movimientos m
      ORDER BY m.estudiante_id, m.fecha DESC, m.id DESC
    )
    SELECT
      e.id AS estudiante_id,
      e.documento,
      e.qr_uid,
      e.nombre,
      e.carrera,
      e.celular,
      e.vigencia,
      moto_principal.placa AS placa,
      moto_principal.color AS color,
      moto_secundaria.placa AS placa_secundaria,
      moto_secundaria.color AS color_secundaria,
      COALESCE(moto_list.motos, '[]'::json) AS motos,
      COALESCE(na.placa_observada, um.vehiculo_placa) AS placa_movimiento_actual
    FROM ultimo_movimiento um
    JOIN estudiantes e ON e.id = um.estudiante_id
    LEFT JOIN novedades_acceso na ON na.movimiento_id = um.id
    LEFT JOIN LATERAL (
      SELECT m.placa, m.color
      FROM motocicletas m
      WHERE m.estudiante_id = e.id
        AND m.is_active = TRUE
        AND m.tipo = 'PRINCIPAL'
      ORDER BY m.id DESC
      LIMIT 1
    ) moto_principal ON TRUE
    LEFT JOIN LATERAL (
      SELECT m.placa, m.color
      FROM motocicletas m
      WHERE m.estudiante_id = e.id
        AND m.is_active = TRUE
        AND m.tipo = 'SECUNDARIA'
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
        ORDER BY CASE m.tipo WHEN 'PRINCIPAL' THEN 0 ELSE 1 END, m.id
      ) AS motos
      FROM motocicletas m
      WHERE m.estudiante_id = e.id
        AND m.is_active = TRUE
    ) moto_list ON TRUE
    WHERE um.tipo = 'ENTRADA'
      AND e.is_deleted = FALSE
      AND UPPER(COALESCE(na.placa_observada, um.vehiculo_placa)) = UPPER($1)
    LIMIT 1
    FOR UPDATE OF e
    `,
    [placa]
  );
}

module.exports = {
  getLastByEstudianteId,
  createMovimiento,
  listAllMovimientos,
  listMovimientosByEstudianteId,
  listDentroCampus,
  findCurrentInsideByPlateForUpdate,
};
