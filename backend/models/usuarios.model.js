const pool = require("../config/database");

async function listUsuarios() {
  return pool.query(
    `
    SELECT id, username, role, created_at
    FROM usuarios
    ORDER BY id ASC
    `
  );
}

async function findByUsername(username) {
  return pool.query(
    `
    SELECT id, username, role, created_at
    FROM usuarios
    WHERE username = $1
    LIMIT 1
    `,
    [username]
  );
}

async function findById(id) {
  return pool.query(
    `
    SELECT id, username, role, created_at
    FROM usuarios
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );
}

async function createUsuario(payload) {
  const { username, passwordHash, role } = payload;

  return pool.query(
    `
    INSERT INTO usuarios (username, password_hash, role)
    VALUES ($1, $2, $3)
    RETURNING id, username, role, created_at
    `,
    [username, passwordHash, role]
  );
}

async function updateUsuario(id, payload) {
  const fields = [];
  const values = [];
  let index = 1;

  if (payload.username) {
    fields.push(`username = $${index++}`);
    values.push(payload.username);
  }

  if (payload.passwordHash) {
    fields.push(`password_hash = $${index++}`);
    values.push(payload.passwordHash);
  }

  if (payload.role) {
    fields.push(`role = $${index++}`);
    values.push(payload.role);
  }

  values.push(id);

  return pool.query(
    `
    UPDATE usuarios
    SET ${fields.join(", ")}
    WHERE id = $${index}
    RETURNING id, username, role, created_at
    `,
    values
  );
}

async function deleteUsuario(id) {
  return pool.query(
    `
    DELETE FROM usuarios
    WHERE id = $1
    RETURNING id, username, role, created_at
    `,
    [id]
  );
}

module.exports = {
  listUsuarios,
  findByUsername,
  findById,
  createUsuario,
  updateUsuario,
  deleteUsuario,
};
