const pool = require("../config/database");
const estudiantesModel = require("../models/estudiantes.model");

const PLACA_REGEX = /^[A-Z]{3}\d{2}[A-Z]$/;

function normalizarTexto(value) {
  return typeof value === "string" ? value.trim() : value;
}

function normalizarPlaca(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : value;
}

function validarPrimerIngreso(body = {}) {
  const documento = normalizarTexto(body.documento);
  const qr_uid = normalizarTexto(body.qr_uid);
  const nombre = normalizarTexto(body.nombre);
  const carrera = normalizarTexto(body.carrera);
  const placa = normalizarPlaca(body.placa);
  const color = normalizarTexto(body.color);
  const { vigencia } = body;

  if (!documento || typeof documento !== "string") return "documento es requerido";
  if (!qr_uid || typeof qr_uid !== "string") return "qr_uid es requerido";
  if (!nombre || typeof nombre !== "string") return "nombre es requerido";
  if (!carrera || typeof carrera !== "string") return "carrera es requerida";
  if (typeof vigencia !== "boolean") return "vigencia debe ser boolean";
  if (!placa || typeof placa !== "string") return "placa es requerida";
  if (!PLACA_REGEX.test(placa)) return "placa debe tener formato ABC12D";
  if (!color || typeof color !== "string") return "color es requerido";

  return null;
}

function sanitizarPrimerIngreso(body = {}) {
  return {
    ...body,
    documento: normalizarTexto(body.documento),
    qr_uid: normalizarTexto(body.qr_uid),
    nombre: normalizarTexto(body.nombre),
    carrera: normalizarTexto(body.carrera),
    placa: normalizarPlaca(body.placa),
    color: normalizarTexto(body.color),
  };
}

function resolverConflictoPrimerIngreso(error) {
  if (!error || error.code !== "23505") {
    return null;
  }

  if (error.constraint === "estudiantes_qr_uid_key") {
    return "qr_uid ya esta registrado en otro estudiante";
  }

  if (error.constraint === "estudiantes_documento_key") {
    return "documento ya esta registrado en otro estudiante";
  }

  return "Ya existe un registro con esos datos unicos";
}

function parseId(rawId) {
  const id = Number(rawId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function primerIngreso(req, res, next) {
  const payload = sanitizarPrimerIngreso(req.body);
  const errorValidacion = validarPrimerIngreso(payload);
  if (errorValidacion) {
    return res.status(400).json({ error: errorValidacion });
  }

  const client = await pool.connect();

  try {
    console.log("[estudiantes] POST /primer-ingreso", { documento: payload.documento });
    await client.query("BEGIN");

    const estudiante = await estudiantesModel.createPrimerIngreso(client, payload);

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Primer ingreso registrado",
      estudiante,
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {
      // no-op
    }

    const conflicto = resolverConflictoPrimerIngreso(error);
    if (conflicto) {
      return res.status(409).json({ error: conflicto });
    }

    return next(error);
  } finally {
    client.release();
  }
}

async function listarEstudiantes(_req, res, next) {
  try {
    console.log("[estudiantes] GET /estudiantes");
    const result = await estudiantesModel.listAll();
    return res.status(200).json({
      count: result.rows.length,
      estudiantes: result.rows,
    });
  } catch (error) {
    return next(error);
  }
}

async function obtenerPorId(req, res, next) {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "id de estudiante invalido" });
  }

  try {
    console.log("[estudiantes] GET /estudiantes/:id", { id });
    const result = await estudiantesModel.findById(id);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Estudiante no encontrado" });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
}

async function obtenerPorDocumento(req, res, next) {
  const { documento } = req.params;

  try {
    console.log("[estudiantes] GET /estudiantes/documento/:documento", { documento });
    const result = await estudiantesModel.findByDocumento(documento);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Estudiante no encontrado" });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  primerIngreso,
  listarEstudiantes,
  obtenerPorId,
  obtenerPorDocumento,
};
