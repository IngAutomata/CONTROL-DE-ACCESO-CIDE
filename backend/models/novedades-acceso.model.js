const pool = require("../config/database");

async function createNovedadAcceso(client = pool, payload = {}) {
  const {
    movimientoId,
    estudianteId,
    tipoNovedad = "MOTO_NO_REGISTRADA",
    placaObservada,
    motivo,
    soporteValidado = false,
    tipoSoporte,
    observaciones = null,
    autorizadoPorUserId = null,
  } = payload;

  return client.query(
    `
    INSERT INTO novedades_acceso (
      movimiento_id,
      estudiante_id,
      tipo_novedad,
      placa_observada,
      motivo,
      soporte_validado,
      tipo_soporte,
      observaciones,
      autorizado_por_user_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
    `,
    [
      movimientoId,
      estudianteId,
      tipoNovedad,
      placaObservada,
      motivo,
      soporteValidado,
      tipoSoporte,
      observaciones,
      autorizadoPorUserId,
    ]
  );
}

async function findByMovimientoId(movimientoId) {
  return pool.query(
    `
    SELECT na.*, u.username AS autorizado_por_username
    FROM novedades_acceso na
    LEFT JOIN usuarios u ON u.id = na.autorizado_por_user_id
    WHERE na.movimiento_id = $1
    LIMIT 1
    `,
    [movimientoId]
  );
}

module.exports = {
  createNovedadAcceso,
  findByMovimientoId,
};
