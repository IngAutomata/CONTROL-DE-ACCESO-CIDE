const pool = require("../config/database");

async function listUsuarios() {
  return pool.query(
    `
    SELECT id, username, role, is_active, deactivated_at, created_at, updated_at
    FROM usuarios
    ORDER BY id ASC
    `
  );
}

async function findByUsername(username) {
  return pool.query(
    `
    SELECT id, username, role, is_active, deactivated_at, created_at, updated_at
    FROM usuarios
    WHERE username = $1 AND is_active = TRUE
    LIMIT 1
    `,
    [username]
  );
}

async function findByUsernameAnyStatus(username) {
  return pool.query(
    `
    SELECT id, username, role, is_active, deactivated_at, created_at, updated_at
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
    SELECT id, username, role, is_active, deactivated_at, created_at, updated_at
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
    RETURNING id, username, role, is_active, deactivated_at, created_at, updated_at
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
    SET ${fields.join(", ")}, updated_at = NOW()
    WHERE id = $${index}
    RETURNING id, username, role, is_active, deactivated_at, created_at, updated_at
    `,
    values
  );
}

async function deactivateUsuario(id) {
  return pool.query(
    `
    UPDATE usuarios
    SET is_active = FALSE,
        deactivated_at = NOW(),
        updated_at = NOW()
    WHERE id = $1
      AND is_active = TRUE
    RETURNING id, username, role, is_active, deactivated_at, created_at, updated_at
    `,
    [id]
  );
}

async function reactivateUsuario(id) {
  return pool.query(
    `
    UPDATE usuarios
    SET is_active = TRUE,
        deactivated_at = NULL,
        updated_at = NOW()
    WHERE id = $1
      AND is_active = FALSE
    RETURNING id, username, role, is_active, deactivated_at, created_at, updated_at
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
  deactivateUsuario,
  reactivateUsuario,
  findByUsernameAnyStatus,
};
