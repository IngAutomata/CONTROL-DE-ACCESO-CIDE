const pool = require("../config/database");
const estudiantesModel = require("../models/estudiantes.model");

function validarPrimerIngreso(body = {}) {
  const { documento, qr_uid, nombre, carrera, vigencia, placa, color } = body;

  if (!documento || typeof documento !== "string") return "documento es requerido";
  if (!qr_uid || typeof qr_uid !== "string") return "qr_uid es requerido";
  if (!nombre || typeof nombre !== "string") return "nombre es requerido";
  if (!carrera || typeof carrera !== "string") return "carrera es requerida";
  if (typeof vigencia !== "boolean") return "vigencia debe ser boolean";
  if (!placa || typeof placa !== "string") return "placa es requerida";
  if (!color || typeof color !== "string") return "color es requerido";

  return null;
}

function parseId(rawId) {
  const id = Number(rawId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function primerIngreso(req, res, next) {
  const errorValidacion = validarPrimerIngreso(req.body);
  if (errorValidacion) {
    return res.status(400).json({ error: "Faltan datos requeridos o vigencia no es boolean" });
  }

  const client = await pool.connect();

  try {
    console.log("[estudiantes] POST /primer-ingreso", { documento: req.body.documento });
    await client.query("BEGIN");

    const estudiante = await estudiantesModel.upsertPrimerIngreso(client, req.body);

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
