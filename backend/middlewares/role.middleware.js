const { unauthorized, forbidden } = require("../utils/response");

function normalizeRole(roleValue) {
  if (typeof roleValue !== "string") return null;

  return roleValue.trim().toUpperCase();
}

function normalizeAllowedRoles(rolesInput) {
  const flatRoles = rolesInput.flatMap((role) => (Array.isArray(role) ? role : [role]));
  return flatRoles.map(normalizeRole).filter(Boolean);
}

function requireRole(...rolesInput) {
  const allowedRoles = normalizeAllowedRoles(rolesInput);

  return function roleMiddleware(req, res, next) {
    if (!req.user) {
      return unauthorized(res, "No autenticado");
    }

    if (!allowedRoles.includes(normalizeRole(req.user.role))) {
      return forbidden(res, "No tienes permisos para este recurso");
    }

    return next();
  };
}

module.exports = requireRole;
