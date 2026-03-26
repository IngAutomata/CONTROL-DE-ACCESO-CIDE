const bcrypt = require("bcrypt");
const usuariosModel = require("../models/usuarios.model");
const estudiantesModel = require("../models/estudiantes.model");
const pool = require("../config/database");
const { ROLES } = require("../constants/roles");

const PLACA_REGEX = /^[A-Z]{3}\d{2}[A-Z]$/;

function normalizeRole(roleValue) {
  if (typeof roleValue !== "string") return null;

  const role = roleValue.trim().toUpperCase();

  if (role === ROLES.ADMIN) return ROLES.ADMIN;
  if (role === ROLES.GUARDA || role === "STAFF") return ROLES.GUARDA;
  if (role === ROLES.CONSULTA) return ROLES.CONSULTA;

  return null;
}

function parseId(rawId) {
  const id = Number(rawId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : value;
}

function normalizePlate(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : value;
}

function validateStudentPayload(body = {}) {
  const documento = normalizeText(body.documento);
  const qr_uid = normalizeText(body.qr_uid);
  const nombre = normalizeText(body.nombre);
  const carrera = normalizeText(body.carrera);
  const placa = normalizePlate(body.placa);
  const color = normalizeText(body.color);
  const { vigencia } = body;

  if (!documento) return "documento es requerido";
  if (!qr_uid) return "qr_uid es requerido";
  if (!nombre) return "nombre es requerido";
  if (!carrera) return "carrera es requerida";
  if (typeof vigencia !== "boolean") return "vigencia debe ser boolean";
  if (!placa) return "placa es requerida";
  if (!PLACA_REGEX.test(placa)) return "placa debe tener formato ABC12D";
  if (!color) return "color es requerido";

  return null;
}

function sanitizeStudentPayload(body = {}) {
  return {
    documento: normalizeText(body.documento),
    qr_uid: normalizeText(body.qr_uid),
    nombre: normalizeText(body.nombre),
    carrera: normalizeText(body.carrera),
    vigencia: body.vigencia,
    placa: normalizePlate(body.placa),
    color: normalizeText(body.color),
  };
}

function buildConflictMessage(error) {
  if (error.code === "23505") {
    if (error.constraint === "estudiantes_qr_uid_key") {
      return "qr_uid ya esta registrado en otro estudiante";
    }

    if (error.constraint === "estudiantes_documento_key") {
      return "documento ya esta registrado en otro estudiante";
    }
  }

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

  try {
    const existing = await usuariosModel.findByUsername(username.trim());

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "El usuario ya existe" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const created = await usuariosModel.createUsuario({
      username: username.trim(),
      passwordHash,
      role: normalizedRole,
    });

    return res.status(201).json({
      message: "Usuario creado",
      usuario: created.rows[0],
    });
  } catch (error) {
    return next(error);
  }
}

async function obtenerUsuarioPorUsername(req, res, next) {
  const username = normalizeText(req.params.username);

  if (!username) {
    return res.status(400).json({ error: "username es requerido" });
  }

  try {
    const result = await usuariosModel.findByUsername(username);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
}

async function actualizarUsuario(req, res, next) {
  const id = parseId(req.params.id);
  const { username, password, role } = req.body || {};

  if (!id) {
    return res.status(400).json({ error: "id de usuario invalido" });
  }

  const payload = {};

  if (typeof username === "string" && username.trim().length > 0) {
    payload.username = username.trim();
  }

  if (typeof role === "string") {
    const normalizedRole = normalizeRole(role);
    if (!normalizedRole) {
      return res.status(400).json({ error: "role invalido" });
    }
    payload.role = normalizedRole;
  }

  if (typeof password === "string" && password.trim().length > 0) {
    if (password.trim().length < 8) {
      return res.status(400).json({ error: "password debe tener al menos 8 caracteres" });
    }

    payload.passwordHash = await bcrypt.hash(password, 10);
  }

  if (Object.keys(payload).length === 0) {
    return res.status(400).json({ error: "Debes enviar al menos un campo para actualizar" });
  }

  try {
    const existing = await usuariosModel.findById(id);

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    if (payload.username) {
      const sameUsername = await usuariosModel.findByUsername(payload.username);
      if (sameUsername.rows.length > 0 && sameUsername.rows[0].id !== id) {
        return res.status(409).json({ error: "El usuario ya existe" });
      }
    }

    const updated = await usuariosModel.updateUsuario(id, payload);

    return res.status(200).json({
      message: "Usuario actualizado",
      usuario: updated.rows[0],
    });
  } catch (error) {
    return next(error);
  }
}

async function actualizarUsuarioPorUsername(req, res, next) {
  const username = normalizeText(req.params.username);

  if (!username) {
    return res.status(400).json({ error: "username es requerido" });
  }

  try {
    const existing = await usuariosModel.findByUsername(username);

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    req.params.id = String(existing.rows[0].id);
    return actualizarUsuario(req, res, next);
  } catch (error) {
    return next(error);
  }
}

async function eliminarUsuario(req, res, next) {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({ error: "id de usuario invalido" });
  }

  try {
    const deleted = await usuariosModel.deleteUsuario(id);

    if (deleted.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    return res.status(200).json({
      message: "Usuario eliminado",
      usuario: deleted.rows[0],
    });
  } catch (error) {
    return next(error);
  }
}

async function eliminarUsuarioPorUsername(req, res, next) {
  const username = normalizeText(req.params.username);

  if (!username) {
    return res.status(400).json({ error: "username es requerido" });
  }

  try {
    const existing = await usuariosModel.findByUsername(username);

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    req.params.id = String(existing.rows[0].id);
    return eliminarUsuario(req, res, next);
  } catch (error) {
    return next(error);
  }
}

async function obtenerEstudiantePorDocumento(req, res, next) {
  const documento = normalizeText(req.params.documento);

  if (!documento) {
    return res.status(400).json({ error: "documento es requerido" });
  }

  try {
    const result = await estudiantesModel.findByDocumento(documento);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Estudiante no encontrado" });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
}

async function obtenerEstudiantePorPlaca(req, res, next) {
  const placa = normalizePlate(req.params.placa);

  if (!placa) {
    return res.status(400).json({ error: "placa es requerida" });
  }

  try {
    const result = await estudiantesModel.findByPlaca(placa);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Estudiante no encontrado" });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
}

async function actualizarEstudiante(req, res, next) {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "id de estudiante invalido" });
  }

  const payload = sanitizeStudentPayload(req.body);
  const validationError = validateStudentPayload(payload);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const updated = await estudiantesModel.updateById(client, id, payload);

    if (updated.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Estudiante no encontrado" });
    }

    await client.query("COMMIT");
    return res.status(200).json({
      message: "Estudiante actualizado",
      estudiante: updated.rows[0],
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {
      // no-op
    }

    const conflict = buildConflictMessage(error);
    if (conflict) {
      return res.status(409).json({ error: conflict });
    }

    return next(error);
  } finally {
    client.release();
  }
}

async function actualizarEstudiantePorDocumento(req, res, next) {
  const documento = normalizeText(req.params.documento);

  if (!documento) {
    return res.status(400).json({ error: "documento es requerido" });
  }

  try {
    const existing = await estudiantesModel.findByDocumento(documento);

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Estudiante no encontrado" });
    }

    req.params.id = String(existing.rows[0].estudiante_id);
    return actualizarEstudiante(req, res, next);
  } catch (error) {
    return next(error);
  }
}

async function eliminarEstudiante(req, res, next) {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "id de estudiante invalido" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const deleted = await estudiantesModel.deleteById(client, id);

    if (deleted.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Estudiante no encontrado" });
    }

    await client.query("COMMIT");
    return res.status(200).json({
      message: "Estudiante eliminado",
      estudiante: deleted.rows[0],
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

async function eliminarEstudiantePorDocumento(req, res, next) {
  const documento = normalizeText(req.params.documento);

  if (!documento) {
    return res.status(400).json({ error: "documento es requerido" });
  }

  try {
    const existing = await estudiantesModel.findByDocumento(documento);

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Estudiante no encontrado" });
    }

    req.params.id = String(existing.rows[0].estudiante_id);
    return eliminarEstudiante(req, res, next);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listarUsuarios,
  crearUsuario,
  obtenerUsuarioPorUsername,
  actualizarUsuario,
  actualizarUsuarioPorUsername,
  eliminarUsuario,
  eliminarUsuarioPorUsername,
  obtenerEstudiantePorDocumento,
  obtenerEstudiantePorPlaca,
  actualizarEstudiante,
  actualizarEstudiantePorDocumento,
  eliminarEstudiante,
  eliminarEstudiantePorDocumento,
};
