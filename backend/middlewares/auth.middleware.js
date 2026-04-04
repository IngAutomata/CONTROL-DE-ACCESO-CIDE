const jwt = require("jsonwebtoken");
const { unauthorized, serverError } = require("../utils/response");

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

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return unauthorized(res, "Token no proporcionado");
  }

  if (!authHeader.startsWith("Bearer ")) {
    return unauthorized(res, "Formato de Authorization invalido. Usa Bearer <token>");
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    return unauthorized(res, "Token no proporcionado");
  }

  const jwtSecret = resolveJwtSecret();

  if (!jwtSecret) {
    return serverError(res, "JWT_SECRET no configurado");
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);

    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: normalizeRole(decoded.role),
    };

    return next();
  } catch (_error) {
    return unauthorized(res, "Token invalido");
  }
}

module.exports = authMiddleware;
