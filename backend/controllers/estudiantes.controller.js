const pool = require("../config/database");
const estudiantesModel = require("../models/estudiantes.model");

const PLACA_REGEX = /^[A-Z]{3}\d{2}[A-Z]$/;
const DOCUMENTO_REGEX = /^\d{8,10}$/;
const CELULAR_REGEX = /^\d{10}$/;
const QR_CIDE_REGEX = /^https:\/\/soe\.cide\.edu\.co\/verificar-estudiante\/[A-Za-z0-9]{1,8}$/;

function normalizarTexto(value) {
  return typeof value === "string" ? value.trim() : value;
}

function normalizarPlaca(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : value;
}

function esDocumentoValido(documento) {
  return typeof documento === "string" && DOCUMENTO_REGEX.test(documento);
}

function esQrCideValido(qrUid) {
  return typeof qrUid === "string" && QR_CIDE_REGEX.test(qrUid);
}

function validarPrimerIngreso(body = {}) {
  const documento = normalizarTexto(body.documento);
  const qr_uid = normalizarTexto(body.qr_uid);
  const nombre = normalizarTexto(body.nombre);
  const carrera = normalizarTexto(body.carrera);
  const celular = normalizarTexto(body.celular);
  const placa = normalizarPlaca(body.placa);
  const color = normalizarTexto(body.color);
  const placa_secundaria = normalizarPlaca(body.placa_secundaria);
  const color_secundaria = normalizarTexto(body.color_secundaria);
  const { vigencia } = body;

  if (!documento || typeof documento !== "string") return "documento es requerido";
  if (!esDocumentoValido(documento)) return "documento debe tener entre 8 y 10 digitos numericos";
  if (!qr_uid || typeof qr_uid !== "string") return "qr_uid es requerido";
  if (!esQrCideValido(qr_uid)) return "qr_uid debe tener formato QR de CIDE";
  if (!nombre || typeof nombre !== "string") return "nombre es requerido";
  if (!carrera || typeof carrera !== "string") return "carrera es requerida";
  if (celular != null && celular !== "" && typeof celular !== "string") return "celular debe ser texto";
  if (celular && !CELULAR_REGEX.test(celular)) return "celular debe tener exactamente 10 numeros";
  if (typeof vigencia !== "boolean") return "vigencia debe ser boolean";
  if (!placa || typeof placa !== "string") return "placa es requerida";
  if (!PLACA_REGEX.test(placa)) return "placa debe tener formato ABC12D";
  if (!color || typeof color !== "string") return "color es requerido";
  if ((placa_secundaria && !color_secundaria) || (!placa_secundaria && color_secundaria)) {
    return "La moto secundaria requiere placa y color";
  }
  if (placa_secundaria && !PLACA_REGEX.test(placa_secundaria)) return "placa_secundaria debe tener formato ABC12D";
  if (placa_secundaria && placa_secundaria === placa) return "La moto secundaria no puede repetir la placa principal";

  return null;
}

function sanitizarPrimerIngreso(body = {}) {
  const payload = {
    ...body,
    documento: normalizarTexto(body.documento),
    qr_uid: normalizarTexto(body.qr_uid),
    nombre: normalizarTexto(body.nombre),
    carrera: normalizarTexto(body.carrera),
    celular: normalizarTexto(body.celular),
    placa: normalizarPlaca(body.placa),
    color: normalizarTexto(body.color),
  };

  const placaSecundaria = normalizarPlaca(body.placa_secundaria);
  const colorSecundaria = normalizarTexto(body.color_secundaria);

  if (placaSecundaria || colorSecundaria) {
    payload.placa_secundaria = placaSecundaria;
    payload.color_secundaria = colorSecundaria;
  }

  return payload;
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

   if (error.constraint === "uq_motocicletas_placa_upper") {
    return "placa ya esta registrada en otro estudiante";
  }

  if (error.constraint === "uq_estudiantes_celular") {
    return "celular ya esta registrado en otro estudiante";
  }

  return "Ya existe un registro con esos datos unicos";
}

async function safeFind(methodName, ...args) {
  const finder = estudiantesModel[methodName];
  if (typeof finder !== "function") {
    return { rows: [] };
  }

  return finder(...args);
}

function buildDuplicateFieldMessage(field) {
  if (field === "documento") return "documento ya esta registrado en otro estudiante";
  if (field === "qr_uid") return "qr_uid ya esta registrado en otro estudiante";
  if (field === "placa") return "placa ya esta registrada en otro estudiante";
  if (field === "placa_secundaria") return "placa ya esta registrada en otro estudiante";
  if (field === "celular") return "celular ya esta registrado en otro estudiante";
  return "Ya existe un registro con esos datos unicos";
}

function resolveStudentId(row) {
  return row?.id ?? row?.estudiante_id ?? null;
}

async function validarDuplicadosPrimerIngreso(client, payload) {
  const checks = [
    { field: "documento", result: await safeFind("findByDocumentoForUpdate", client, payload.documento) },
    { field: "qr_uid", result: await safeFind("findByQrCandidatesForUpdate", client, [payload.qr_uid]) },
    { field: "placa", result: await safeFind("findByPlacaForUpdate", client, payload.placa) },
    { field: "placa_secundaria", result: payload.placa_secundaria ? await safeFind("findByPlacaForUpdate", client, payload.placa_secundaria) : { rows: [] } },
    { field: "celular", result: payload.celular ? await safeFind("findByCelularForUpdate", client, payload.celular) : { rows: [] } },
  ];

  const conflict = checks.find(({ result }) => (result.rows || []).length > 0);
  return conflict ? buildDuplicateFieldMessage(conflict.field) : null;
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

    const conflictoDuplicado = await validarDuplicadosPrimerIngreso(client, payload);
    if (conflictoDuplicado) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: conflictoDuplicado });
    }

    const estudiante = await estudiantesModel.createPrimerIngreso(client, payload, {
      actorUserId: req.user?.id || null,
    });

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

async function obtenerPorPlaca(req, res, next) {
  const placa = normalizarPlaca(req.params.placa);

  if (!placa) {
    return res.status(400).json({ error: "placa es requerida" });
  }

  try {
    console.log("[estudiantes] GET /estudiantes/placa/:placa", { placa });
    const result = await estudiantesModel.findByPlaca(placa);

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
  obtenerPorPlaca,
};
