const pool = require("../config/database");
const visitantesModel = require("../models/visitantes.model");
const movimientosVisitantesModel = require("../models/movimientos-visitantes.model");

const DOCUMENTO_REGEX = /^[A-Z0-9-]{5,20}$/;
const CELULAR_REGEX = /^\d{10}$/;
const PLACA_REGEX = /^[A-Z]{3}\d{2}[A-Z0-9]$/;

function normalizarTexto(value) {
  return typeof value === "string" ? value.trim() : value;
}

function normalizarDocumento(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : value;
}

function normalizarPlaca(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : value;
}

function sanitizeVisitantePayload(body = {}) {
  return {
    documento: normalizarDocumento(body.documento),
    nombre: normalizarTexto(body.nombre),
    celular: normalizarTexto(body.celular),
    placa: normalizarPlaca(body.placa),
    entidad: normalizarTexto(body.entidad),
    motivo_visita: normalizarTexto(body.motivo_visita),
    persona_visitada: normalizarTexto(body.persona_visitada),
    observaciones: normalizarTexto(body.observaciones),
  };
}

function validateVisitanteEntryPayload(payload = {}) {
  if (!payload.documento) return "documento es requerido";
  if (!DOCUMENTO_REGEX.test(payload.documento)) return "documento debe tener entre 5 y 20 caracteres alfanuméricos";
  if (!payload.nombre) return "nombre es requerido";
  if (!payload.celular) return "celular es requerido";
  if (!CELULAR_REGEX.test(payload.celular)) return "celular debe tener exactamente 10 números";
  if (payload.placa && !PLACA_REGEX.test(payload.placa)) return "placa debe tener formato válido colombiano";
  if (!payload.motivo_visita) return "motivo_visita es requerido";
  if (!payload.persona_visitada) return "persona_visitada es requerida";
  return null;
}

function validateVisitanteLookup(payload = {}) {
  if (!payload.documento && !payload.placa) return "Debes indicar documento o placa del visitante";
  if (payload.documento && !DOCUMENTO_REGEX.test(payload.documento)) return "documento debe tener entre 5 y 20 caracteres alfanuméricos";
  if (payload.placa && !PLACA_REGEX.test(payload.placa)) return "placa debe tener formato válido colombiano";
  return null;
}

async function registrarMovimientoVisitante(req, res, next) {
  const payload = sanitizeVisitantePayload(req.body);
  const validationError = validateVisitanteLookup(payload);

  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    let visitante = null;
    let lastMovement = null;
    let tipo = "ENTRADA";

    if (payload.documento) {
      const visitanteResult = await visitantesModel.findByDocumentoForUpdate(client, payload.documento);
      visitante = visitanteResult.rows[0] || null;

      if (visitante) {
        const lastResult = await movimientosVisitantesModel.getLastByVisitanteId(client, visitante.id);
        lastMovement = lastResult.rows[0] || null;
        if (lastMovement?.tipo === "ENTRADA") {
          tipo = "SALIDA";
        }
      }

      if (tipo === "ENTRADA") {
        const entryError = validateVisitanteEntryPayload(payload);
        if (entryError) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: entryError });
        }

        if (payload.placa) {
          const duplicatePlate = await visitantesModel.findByPlacaForUpdate(client, payload.placa);
          const plateOwner = duplicatePlate.rows[0] || null;
          if (plateOwner && (!visitante || plateOwner.id !== visitante.id)) {
            await client.query("ROLLBACK");
            return res.status(409).json({ error: "Ya existe otro visitante con esa placa registrada" });
          }
        }

        if (visitante) {
          const updated = await visitantesModel.updateVisitante(client, visitante.id, payload);
          visitante = updated.rows[0];
        } else {
          const created = await visitantesModel.createVisitante(client, payload);
          visitante = created.rows[0];
        }
      } else {
        if (payload.placa && lastMovement?.vehiculo_placa && normalizarPlaca(payload.placa) !== normalizarPlaca(lastMovement.vehiculo_placa)) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: "La placa no coincide con el vehículo con el que el visitante registró el ingreso" });
        }
      }
    } else {
      const insideResult = await movimientosVisitantesModel.findCurrentInsideByPlateForUpdate(client, payload.placa);
      visitante = insideResult.rows[0] || null;

      if (!visitante) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "No hay un visitante dentro del campus con esa placa. Para registrar entrada usa documento." });
      }

      tipo = "SALIDA";
      const lastResult = await movimientosVisitantesModel.getLastByVisitanteId(client, visitante.id);
      lastMovement = lastResult.rows[0] || null;
    }

    if (!visitante) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Visitante no encontrado" });
    }

    const movimiento = await movimientosVisitantesModel.createMovimientoVisitante(client, visitante.id, tipo, {
      motivoVisita: tipo === "ENTRADA" ? payload.motivo_visita : null,
      personaVisitada: tipo === "ENTRADA" ? payload.persona_visitada : null,
      observaciones: payload.observaciones || null,
      vehiculoPlaca: tipo === "SALIDA"
        ? (lastMovement?.vehiculo_placa || visitante.placa || payload.placa || null)
        : (payload.placa || visitante.placa || null),
      actorUserId: req.user?.id || null,
    });

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Movimiento de visitante registrado",
      visitante,
      movimiento: movimiento.rows[0],
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

async function listarVisitantes(_req, res, next) {
  try {
    const result = await visitantesModel.listVisitantes();
    return res.status(200).json({ count: result.rows.length, visitantes: result.rows });
  } catch (error) {
    return next(error);
  }
}

async function obtenerVisitantePorDocumento(req, res, next) {
  const documento = normalizarDocumento(req.params.documento);
  if (!documento || !DOCUMENTO_REGEX.test(documento)) {
    return res.status(400).json({ error: "documento inválido" });
  }

  try {
    const result = await visitantesModel.findByDocumento(pool, documento);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Visitante no encontrado" });
    }
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
}

async function listarMovimientosVisitantes(_req, res, next) {
  try {
    const result = await movimientosVisitantesModel.listAllMovimientosVisitantes();
    return res.status(200).json({ count: result.rows.length, movimientos: result.rows });
  } catch (error) {
    return next(error);
  }
}

async function listarVisitantesDentroCampus(_req, res, next) {
  try {
    const result = await movimientosVisitantesModel.listDentroCampusVisitantes();
    return res.status(200).json({ count: result.rows.length, visitantes: result.rows });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listarMovimientosVisitantes,
  listarVisitantes,
  listarVisitantesDentroCampus,
  obtenerVisitantePorDocumento,
  registrarMovimientoVisitante,
  sanitizeVisitantePayload,
  validateVisitanteEntryPayload,
  validateVisitanteLookup,
};