const pool = require("../config/database");

async function createAuditLog(client, payload) {
  const {
    actorUserId = null,
    tabla,
    registroId = null,
    tipoMovimiento,
    descripcion = null,
  } = payload;

  return client.query(
    `
    INSERT INTO auditoria (actor_user_id, tabla, registro_id, tipo_movimiento, descripcion)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, actor_user_id, tabla, registro_id, tipo_movimiento, descripcion, created_at
    `,
    [actorUserId, tabla, registroId, tipoMovimiento, descripcion]
  );
}

async function listAuditLogs() {
  return pool.query(
    `
    SELECT
      a.id,
      a.actor_user_id,
      u.username AS actor_username,
      u.role AS actor_role,
      a.tabla,
      a.registro_id,
      a.tipo_movimiento,
      a.descripcion,
      a.created_at
    FROM auditoria a
    LEFT JOIN usuarios u ON u.id = a.actor_user_id
    ORDER BY a.created_at DESC, a.id DESC
    `
  );
}

module.exports = {
  createAuditLog,
  listAuditLogs,
};
