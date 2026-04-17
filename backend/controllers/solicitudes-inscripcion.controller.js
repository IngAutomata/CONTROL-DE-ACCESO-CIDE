const pool = require("../config/database");
const estudiantesModel = require("../models/estudiantes.model");
const solicitudesModel = require("../models/solicitudes-inscripcion.model");
const {
  notifySolicitudAprobada,
  notifySolicitudCreada,
  notifySolicitudExpirada,
  notifySolicitudRechazada,
} = require("../utils/solicitud-mailer");
const { removeStoredFiles, storeAttachment } = require("../utils/solicitud-uploads");

const PLACA_REGEX = /^[A-Z]{3}\d{2}[A-Z]$/;
const DOCUMENTO_REGEX = /^\d{8,10}$/;
const CELULAR_REGEX = /^\d{10}$/;
const QR_CIDE_REGEX = /^https:\/\/soe\.cide\.edu\.co\/verificar-estudiante\/[A-Za-z0-9]{1,8}$/;
const CORREO_INSTITUCIONAL_REGEX = /^[A-Za-z0-9._%+-]+@cide\.edu\.co$/i;

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : value;
}

function normalizePlate(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : value;
}

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : value;
}

function parseId(rawId) {
  const id = Number(rawId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function sanitizeSolicitudPayload(body = {}) {
  return {
    documento: normalizeText(body.documento),
    qr_uid: normalizeText(body.qr_uid),
    nombre: normalizeText(body.nombre),
    carrera: normalizeText(body.carrera),
    correo_institucional: normalizeEmail(body.correo_institucional),
    celular: normalizeText(body.celular),
    placa: normalizePlate(body.placa),
    color: normalizeText(body.color),
    placa_secundaria: normalizePlate(body.placa_secundaria),
    color_secundaria: normalizeText(body.color_secundaria),
    qr_imagen_url: normalizeText(body.qr_imagen_url),
    tarjeta_propiedad_principal_url: normalizeText(body.tarjeta_propiedad_principal_url),
    tarjeta_propiedad_secundaria_url: normalizeText(body.tarjeta_propiedad_secundaria_url),
    qr_imagen_file: body.qr_imagen_file || null,
    tarjeta_propiedad_principal_file: body.tarjeta_propiedad_principal_file || null,
    tarjeta_propiedad_secundaria_file: body.tarjeta_propiedad_secundaria_file || null,
    autoriza_tratamiento_datos: body.autoriza_tratamiento_datos === true,
  };
}

function validateSolicitudPayload(payload = {}) {
  if (!payload.documento) return "documento es requerido";
  if (!DOCUMENTO_REGEX.test(payload.documento)) return "documento debe tener entre 8 y 10 dígitos numéricos";
  if (!payload.qr_uid) return "qr_uid es requerido";
  if (!QR_CIDE_REGEX.test(payload.qr_uid)) return "qr_uid debe tener formato QR de CIDE";
  if (!payload.nombre) return "nombre es requerido";
  if (!payload.carrera) return "carrera es requerida";
  if (!payload.correo_institucional) return "correo_institucional es requerido";
  if (!CORREO_INSTITUCIONAL_REGEX.test(payload.correo_institucional)) return "correo_institucional debe pertenecer al dominio @cide.edu.co";
  if (!payload.celular) return "celular es requerido";
  if (!CELULAR_REGEX.test(payload.celular)) return "celular debe tener exactamente 10 números";
  if (!payload.placa) return "placa es requerida";
  if (!PLACA_REGEX.test(payload.placa)) return "placa debe tener formato ABC12D";
  if (!payload.color) return "color es requerido";
  if ((payload.placa_secundaria && !payload.color_secundaria) || (!payload.placa_secundaria && payload.color_secundaria)) {
    return "La moto secundaria requiere placa y color";
  }
  if (payload.placa_secundaria && !PLACA_REGEX.test(payload.placa_secundaria)) return "placa_secundaria debe tener formato ABC12D";
  if (payload.placa_secundaria && payload.placa_secundaria === payload.placa) return "La moto secundaria no puede repetir la placa principal";
  if (!payload.qr_imagen_url && !payload.qr_imagen_file) return "Debes adjuntar la imagen del QR institucional";
  if (!payload.tarjeta_propiedad_principal_url && !payload.tarjeta_propiedad_principal_file) return "Debes adjuntar la tarjeta de propiedad de la moto principal";
  if (payload.placa_secundaria && !payload.tarjeta_propiedad_secundaria_url && !payload.tarjeta_propiedad_secundaria_file) return "La moto secundaria requiere foto de tarjeta de propiedad";
  if (!payload.autoriza_tratamiento_datos) return "Debes autorizar el tratamiento de datos antes de enviar la solicitud";

  return null;
}

async function persistSolicitudAttachments(payload) {
  const storedPaths = [];
  const nextPayload = { ...payload };

  if (payload.qr_imagen_file) {
    const stored = await storeAttachment(payload.qr_imagen_file, {
      label: "QR institucional",
      prefix: `${payload.documento}-qr`,
    });
    storedPaths.push(stored.absolutePath);
    nextPayload.qr_imagen_url = stored.publicUrl;
  }

  if (payload.tarjeta_propiedad_principal_file) {
    const stored = await storeAttachment(payload.tarjeta_propiedad_principal_file, {
      label: "tarjeta de propiedad principal",
      prefix: `${payload.documento}-moto-principal`,
    });
    storedPaths.push(stored.absolutePath);
    nextPayload.tarjeta_propiedad_principal_url = stored.publicUrl;
  }

  if (payload.tarjeta_propiedad_secundaria_file) {
    const stored = await storeAttachment(payload.tarjeta_propiedad_secundaria_file, {
      label: "tarjeta de propiedad secundaria",
      prefix: `${payload.documento}-moto-secundaria`,
    });
    storedPaths.push(stored.absolutePath);
    nextPayload.tarjeta_propiedad_secundaria_url = stored.publicUrl;
  }

  delete nextPayload.qr_imagen_file;
  delete nextPayload.tarjeta_propiedad_principal_file;
  delete nextPayload.tarjeta_propiedad_secundaria_file;

  return { payload: nextPayload, storedPaths };
}

async function ensureNoStudentConflict(client, payload) {
  const checks = [
    { field: "documento", result: await estudiantesModel.findByDocumentoForUpdate(client, payload.documento) },
    { field: "qr_uid", result: await estudiantesModel.findByQrCandidatesForUpdate(client, [payload.qr_uid]) },
    { field: "placa", result: await estudiantesModel.findByPlacaForUpdate(client, payload.placa) },
    { field: "placa_secundaria", result: payload.placa_secundaria ? await estudiantesModel.findByPlacaForUpdate(client, payload.placa_secundaria) : { rows: [] } },
    { field: "celular", result: payload.celular ? await estudiantesModel.findByCelularForUpdate(client, payload.celular) : { rows: [] } },
  ];

  const conflict = checks.find(({ result }) => (result.rows || []).length > 0);

  if (!conflict) return null;
  if (conflict.field === "documento") return "Ya existe un estudiante con ese documento";
  if (conflict.field === "qr_uid") return "Ya existe un estudiante con ese QR";
  if (conflict.field === "placa" || conflict.field === "placa_secundaria") return "Ya existe un estudiante con esa placa";
  if (conflict.field === "celular") return "Ya existe un estudiante con ese celular";
  return "Ya existe un estudiante con esos datos";
}

async function notifyExpiredSolicitudes(expiredRows = []) {
  await Promise.all((expiredRows || []).map((row) => notifySolicitudExpirada(row)));
}

async function expirePendingAndNotify(db = pool) {
  const expired = await solicitudesModel.expirePending(db);
  await notifyExpiredSolicitudes(expired.rows || []);
  return expired;
}

async function crearSolicitudInscripcion(req, res, next) {
  const payload = sanitizeSolicitudPayload(req.body);
  const validationError = validateSolicitudPayload(payload);
  let storedPaths = [];
  let expiredRows = [];

  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const expired = await solicitudesModel.expirePending(client);
    expiredRows = expired.rows || [];

    const pendingConflict = await solicitudesModel.findPendingConflict(client, payload);
    if (pendingConflict.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Ya existe una solicitud pendiente con ese documento, QR o correo institucional" });
    }

    const studentConflict = await ensureNoStudentConflict(client, payload);
    if (studentConflict) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: studentConflict });
    }

    const persisted = await persistSolicitudAttachments(payload);
    storedPaths = persisted.storedPaths;

    const created = await solicitudesModel.createSolicitud(client, persisted.payload);
    const solicitud = await solicitudesModel.findById(client, created.rows[0].id, { forUpdate: false });

    await client.query("COMMIT");
    await notifyExpiredSolicitudes(expiredRows);
    await notifySolicitudCreada(solicitud.rows[0]);

    return res.status(201).json({
      message: "Solicitud de inscripción registrada",
      solicitud: solicitud.rows[0],
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {
      // no-op
    }
    await removeStoredFiles(storedPaths);
    return next(error);
  } finally {
    client.release();
  }
}

async function listarSolicitudesInscripcion(req, res, next) {
  const estado = normalizeText(req.query.estado)?.toUpperCase() || null;

  try {
    await expirePendingAndNotify();
    const result = await solicitudesModel.listSolicitudes(pool, { estado });
    return res.status(200).json({
      count: result.rows.length,
      solicitudes: result.rows,
    });
  } catch (error) {
    return next(error);
  }
}

async function obtenerSolicitudInscripcion(req, res, next) {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "id de solicitud inválido" });
  }

  try {
    await expirePendingAndNotify();
    const result = await solicitudesModel.findById(pool, id);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Solicitud no encontrada" });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
}

async function aprobarSolicitudInscripcion(req, res, next) {
  const id = parseId(req.params.id);
  const notasRevision = normalizeText(req.body?.notas_revision) || null;
  let expiredRows = [];

  if (!id) {
    return res.status(400).json({ error: "id de solicitud inválido" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const expired = await solicitudesModel.expirePending(client);
    expiredRows = expired.rows || [];
    const existing = await solicitudesModel.findById(client, id, { forUpdate: true });

    if (existing.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Solicitud no encontrada" });
    }

    const solicitud = existing.rows[0];

    if (solicitud.estado !== solicitudesModel.SOLICITUD_ESTADOS.PENDIENTE) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: `La solicitud ya fue procesada con estado ${solicitud.estado}` });
    }

    if (new Date(solicitud.expires_at).getTime() <= Date.now()) {
      await solicitudesModel.markRejected(client, id, {
        reviewedByUserId: req.user?.id || null,
        motivoRechazo: "Solicitud expirada por falta de revisión en 48 horas.",
        notasRevision,
        estado: solicitudesModel.SOLICITUD_ESTADOS.EXPIRADA,
      });
      const expirada = await solicitudesModel.findById(client, id);
      await client.query("COMMIT");
      await notifyExpiredSolicitudes([...expiredRows, ...expirada.rows]);
      return res.status(409).json({ error: "La solicitud expiró y ya no puede aprobarse" });
    }

    const conflict = await ensureNoStudentConflict(client, solicitud);
    if (conflict) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: conflict });
    }

    const estudiante = await estudiantesModel.createPrimerIngreso(
      client,
      {
        documento: solicitud.documento,
        qr_uid: solicitud.qr_uid,
        nombre: solicitud.nombre,
        carrera: solicitud.carrera,
        celular: solicitud.celular,
        vigencia: true,
        placa: solicitud.placa,
        color: solicitud.color,
        placa_secundaria: solicitud.placa_secundaria,
        color_secundaria: solicitud.color_secundaria,
      },
      {
        actorUserId: req.user?.id || null,
      }
    );

    await solicitudesModel.markApproved(client, id, {
      reviewedByUserId: req.user?.id || null,
      notasRevision,
    });

    const updatedSolicitud = await solicitudesModel.findById(client, id);
    await client.query("COMMIT");
    await notifyExpiredSolicitudes(expiredRows);
    await notifySolicitudAprobada(updatedSolicitud.rows[0]);

    return res.status(200).json({
      message: "Solicitud aprobada y estudiante creado",
      solicitud: updatedSolicitud.rows[0],
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

async function rechazarSolicitudInscripcion(req, res, next) {
  const id = parseId(req.params.id);
  const motivoRechazo = normalizeText(req.body?.motivo_rechazo);
  const notasRevision = normalizeText(req.body?.notas_revision) || null;
  let expiredRows = [];

  if (!id) {
    return res.status(400).json({ error: "id de solicitud inválido" });
  }

  if (!motivoRechazo) {
    return res.status(400).json({ error: "motivo_rechazo es requerido" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const expired = await solicitudesModel.expirePending(client);
    expiredRows = expired.rows || [];
    const existing = await solicitudesModel.findById(client, id, { forUpdate: true });

    if (existing.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Solicitud no encontrada" });
    }

    const solicitud = existing.rows[0];

    if (solicitud.estado !== solicitudesModel.SOLICITUD_ESTADOS.PENDIENTE) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: `La solicitud ya fue procesada con estado ${solicitud.estado}` });
    }

    await solicitudesModel.markRejected(client, id, {
      reviewedByUserId: req.user?.id || null,
      motivoRechazo,
      notasRevision,
    });

    const updatedSolicitud = await solicitudesModel.findById(client, id);
    await client.query("COMMIT");
    await notifyExpiredSolicitudes(expiredRows);
    await notifySolicitudRechazada(updatedSolicitud.rows[0]);

    return res.status(200).json({
      message: "Solicitud rechazada",
      solicitud: updatedSolicitud.rows[0],
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
  aprobarSolicitudInscripcion,
  crearSolicitudInscripcion,
  listarSolicitudesInscripcion,
  obtenerSolicitudInscripcion,
  rechazarSolicitudInscripcion,
  sanitizeSolicitudPayload,
  validateSolicitudPayload,
};
