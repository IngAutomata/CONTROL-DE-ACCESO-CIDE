const bcrypt = require("bcrypt");
const pool = require("../config/database");
const usuariosModel = require("../models/usuarios.model");
const auditoriaModel = require("../models/auditoria.model");
const { ROLES } = require("../constants/roles");
const { AUDIT_TABLES, AUDIT_TYPES } = require("../constants/auditTypes");

function normalizeRole(roleValue) {
  if (typeof roleValue !== "string") return null;

  const role = roleValue.trim().toUpperCase();

  if (role === ROLES.ADMIN) return ROLES.ADMIN;
  if (role === ROLES.GUARDA || role === "STAFF") return ROLES.GUARDA;
  if (role === ROLES.CONSULTA) return ROLES.CONSULTA;

  return null;
}

async function listarUsuarios(_req, res, next) {
  try {
    const result = await usuariosModel.listUsuarios();
    return res.status(200).json({
      count: result.rows.length,
      usuarios: result.rows,
    });
  } catch (error) {
    return next(error);
  }
}

async function listarAuditoria(_req, res, next) {
  try {
    const result = await auditoriaModel.listAuditLogs();
    return res.status(200).json({
      count: result.rows.length,
      auditoria: result.rows,
    });
  } catch (error) {
    return next(error);
  }
}

async function crearUsuario(req, res, next) {
  const { username, password, role } = req.body || {};
  const normalizedRole = normalizeRole(role);

  if (!username || typeof username !== "string") {
    return res.status(400).json({ error: "username es requerido" });
  }

  if (!password || typeof password !== "string" || password.trim().length < 8) {
    return res.status(400).json({ error: "password debe tener al menos 8 caracteres" });
  }

  if (!normalizedRole) {
    return res.status(400).json({ error: "role invalido" });
  }

  const client = await pool.connect();

  try {
    const existing = await usuariosModel.findByUsername(username.trim());

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "El usuario ya existe" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await client.query("BEGIN");

    const created = await usuariosModel.createUsuario(client, {
      username: username.trim(),
      passwordHash,
      role: normalizedRole,
      actorUserId: req.user?.id ?? null,
    });

    await auditoriaModel.createAuditLog(client, {
      actorUserId: req.user?.id ?? null,
      tabla: AUDIT_TABLES.USUARIOS,
      registroId: created.rows[0].id,
      tipoMovimiento: AUDIT_TYPES.CREAR_USUARIO,
      descripcion: `Se creo el usuario ${created.rows[0].username} con rol ${created.rows[0].role}`,
    });

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Usuario creado",
      usuario: created.rows[0],
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {
      // no-op
    }
    return next(error);
  } finally {
    client.release();
  }
}

module.exports = {
  listarUsuarios,
  listarAuditoria,
  crearUsuario,
};
