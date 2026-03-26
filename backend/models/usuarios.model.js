const pool = require("../config/database");

async function listUsuarios() {
  return pool.query(
    `
    SELECT id, username, role, created_at, updated_at, created_by, updated_by
    FROM usuarios
    ORDER BY id ASC
    `
  );
}

async function findByUsername(username) {
  return pool.query(
    `
    SELECT id, username, role, created_at, updated_at, created_by, updated_by
    FROM usuarios
    WHERE username = $1
    LIMIT 1
    `,
    [username]
  );
}

async function createUsuario(clientOrPayload, payloadMaybe) {
  const client = payloadMaybe ? clientOrPayload : pool;
  const payload = payloadMaybe || clientOrPayload;
  const { username, passwordHash, role, actorUserId = null } = payload;

  return client.query(
    `
    INSERT INTO usuarios (username, password_hash, role, created_by, updated_by)
    VALUES ($1, $2, $3, $4, $4)
    RETURNING id, username, role, created_at, updated_at, created_by, updated_by
    `,
    [username, passwordHash, role, actorUserId]
  );
}

module.exports = {
  listUsuarios,
  findByUsername,
  createUsuario,
};
