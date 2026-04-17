const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/database");
const { ok, badRequest, unauthorized, serverError } = require("../utils/response");

function resolveJwtSecret() {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length > 0) {
    return process.env.JWT_SECRET;
  }

  if (process.env.NODE_ENV && process.env.NODE_ENV !== "production") {
    return "dev-secret";
  }

  return null;
}

function normalizeRole(roleValue) {
  if (typeof roleValue !== "string") return null;

  const role = roleValue.trim().toUpperCase();

  if (role === "ADMIN") return "ADMIN";
  if (role === "GUARDA" || role === "STAFF") return "GUARDA";
  if (role === "CONSULTA") return "CONSULTA";

  return role;
}

async function login(req, res) {
  const rawUsername = typeof req.body?.username === "string" ? req.body.username : "";
  const username = rawUsername.trim().toLowerCase();
  const { password } = req.body || {};

  if (!username || !password) {
    return badRequest(res, "username y password son requeridos");
  }

  try {
    const result = await pool.query(
      "SELECT id, username, password_hash, role FROM usuarios WHERE username = $1 AND is_active = TRUE LIMIT 1",
      [username]
    );

    if (result.rows.length === 0) {
      return unauthorized(res, "Credenciales invalidas");
    }

    const dbUser = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, dbUser.password_hash);

    if (!isValidPassword) {
      return unauthorized(res, "Credenciales invalidas");
    }

    const jwtSecret = resolveJwtSecret();
    if (!jwtSecret) {
      return serverError(res, "JWT_SECRET no configurado");
    }

    const payload = {
      id: dbUser.id,
      username: dbUser.username,
      role: normalizeRole(dbUser.role),
    };

    const token = jwt.sign(payload, jwtSecret, { expiresIn: "8h" });

    return ok(res, {
      token,
      user: payload,
    });
  } catch (error) {
    console.error(error);
    return serverError(res, "Error en login");
  }
}

module.exports = {
  login,
};
