const pool = require("../config/database");
const estudiantesModel = require("../models/estudiantes.model");
const movimientosModel = require("../models/movimientos.model");
const novedadesAccesoModel = require("../models/novedades-acceso.model");

const QR_CIDE_REGEX = /^https:\/\/soe\.cide\.edu\.co\/verificar-estudiante\/[A-Za-z0-9]{1,8}$/;
const NOVEDAD_MOTIVOS = new Set([
  "Vehículo alterno del estudiante",
  "Moto principal en mantenimiento",
  "Uso ocasional autorizado",
  "Otro",
]);
const TIPO_SOPORTE_VALIDO = new Set(["TARJETA_PROPIEDAD", "RUNT"]);

function esQrCideValido(value) {
  return typeof value === "string" && QR_CIDE_REGEX.test(value.trim());
}

function normalizarTexto(value) {
  return typeof value === "string" ? value.trim() : value;
}

function normalizarPlaca(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : value;
}

function extraerQrUid(input) {
  if (!input || typeof input !== "string") return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1] : null;
  } catch (_) {
    // no-op
  }

  const sinQueryNiHash = trimmed.split(/[?#]/)[0];
  const parts = sinQueryNiHash.split("/").filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : null;
}

function construirQrCandidates(input) {
  if (!input || typeof input !== "string") return [];

  const trimmed = input.trim();
  if (!trimmed) return [];

  const extracted = extraerQrUid(trimmed);
  return Array.from(new Set([trimmed, extracted].filter(Boolean)));
}

function parseId(rawId) {
  const id = Number(rawId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function normalizeMotivo(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSupportType(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function hasRegisteredPlate(estudiante, placa) {
  const normalized = normalizarPlaca(placa);
  if (!normalized || !estudiante) return false;

  const motos = Array.isArray(estudiante.motos) ? estudiante.motos : [];
  return motos.some((moto) => normalizarPlaca(moto?.placa) === normalized && moto?.is_active !== false);
}

function matchesLastVehicle(lastRow, placa) {
  return normalizarPlaca(lastRow?.vehiculo_placa) === normalizarPlaca(placa);
}

function resolveStudentId(estudiante) {
  return estudiante?.estudiante_id ?? estudiante?.id ?? null;
}

function validateNovedadPayload(body = {}, placa) {
  const novedad = body?.novedad || {};
  const motivo = normalizeMotivo(novedad.motivo);
  const tipoSoporte = normalizeSupportType(novedad.tipo_soporte);
  const observaciones = normalizarTexto(novedad.observaciones);

  if (!placa) return "La novedad requiere una placa observada.";
  if (!motivo) return "Debes indicar el motivo de la novedad.";
  if (!NOVEDAD_MOTIVOS.has(motivo)) return "El motivo de la novedad no es válido.";
  if (motivo === "Otro" && !observaciones) return "Debes agregar una observación cuando eliges 'Otro'.";
  if (novedad.soporte_validado !== true) return "Debes confirmar que validaste la tarjeta de propiedad o RUNT.";
  if (!TIPO_SOPORTE_VALIDO.has(tipoSoporte)) return "Debes indicar si validaste por TARJETA_PROPIEDAD o RUNT.";

  return null;
}

async function registrarMovimiento(req, res, next) {
  const body = req.body || {};
  const qrRaw = body.qr_uid || body.qr_url;
  const documento = normalizarTexto(body.documento);
  const placa = normalizarPlaca(body.placa);
  const qrUid = extraerQrUid(qrRaw);
  const qrCandidates = construirQrCandidates(qrRaw);
  const requestHasNovedad = Boolean(body.novedad);

  if (!qrRaw && !documento && !placa) {
    return res.status(400).json({ error: "Falta qr_uid, qr_url, documento o placa" });
  }

  if (documento && !qrRaw && !placa) {
    return res.status(400).json({
      error: "Cuando registras por cédula debes indicar con cuál moto ingresa el estudiante.",
    });
  }

  if (qrRaw && !qrUid) {
    return res.status(400).json({ error: "Falta qr_uid o qr_url" });
  }

  if (qrRaw && !esQrCideValido(qrRaw)) {
    return res.status(400).json({ error: "qr_uid debe tener formato QR de CIDE" });
  }

  const client = await pool.connect();

  try {
    console.log("[movimientos] POST /movimientos/registrar", { qr_uid: qrUid, documento, placa });
    await client.query("BEGIN");

    let est;
    let usingNovedad = false;

    if (qrRaw) {
      est = estudiantesModel.findByQrCandidatesForUpdate
        ? await estudiantesModel.findByQrCandidatesForUpdate(client, qrCandidates)
        : await estudiantesModel.findByQrUidForUpdate(client, qrUid);
    } else if (documento) {
      est = estudiantesModel.findByDocumentoForUpdate
        ? await estudiantesModel.findByDocumentoForUpdate(client, documento)
        : await estudiantesModel.findByDocumento(documento);

      if (est.rows.length > 0) {
        usingNovedad = !hasRegisteredPlate(est.rows[0], placa);

        if (usingNovedad && !requestHasNovedad) {
          const lastPreview = await movimientosModel.getLastByEstudianteId(client, est.rows[0].estudiante_id || est.rows[0].id);
          const canUseLastVehicleForExit =
            lastPreview.rows.length > 0 &&
            lastPreview.rows[0].tipo === "ENTRADA" &&
            matchesLastVehicle(lastPreview.rows[0], placa);

          if (canUseLastVehicleForExit) {
            usingNovedad = false;
          } else {
            await client.query("ROLLBACK");
            return res.status(400).json({
              error: "La moto seleccionada no está registrada para este estudiante. Debes registrar el ingreso con novedad.",
            });
          }
        }
      }
    } else {
      est = estudiantesModel.findByPlacaForUpdate
        ? await estudiantesModel.findByPlacaForUpdate(client, placa)
        : await estudiantesModel.findByPlaca(placa);

      if (est.rows.length === 0 && movimientosModel.findCurrentInsideByPlateForUpdate) {
        est = await movimientosModel.findCurrentInsideByPlateForUpdate(client, placa);
      }
    }

    if (est.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        error: qrRaw ? "QR no registrado" : "Estudiante no encontrado",
        qr_uid: qrRaw ? qrUid : undefined,
        documento: documento || undefined,
        placa: placa || undefined,
      });
    }

    const estudiante = est.rows[0];

    const estudianteId = resolveStudentId(estudiante);

    if (!estudianteId) {
      await client.query("ROLLBACK");
      return res.status(500).json({ error: "No fue posible resolver el estudiante para registrar el movimiento." });
    }

    if (estudiante.vigencia !== true) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Estudiante no vigente", estudiante_id: estudianteId });
    }

    const last = await movimientosModel.getLastByEstudianteId(client, estudianteId);

    let tipo = "ENTRADA";
    if (last.rows.length > 0 && last.rows[0].tipo === "ENTRADA") {
      tipo = "SALIDA";
    }

    if (usingNovedad) {
      const novedadError = validateNovedadPayload(body, placa);
      if (novedadError) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: novedadError });
      }

      if (tipo !== "ENTRADA") {
        if (matchesLastVehicle(last.rows[0], placa)) {
          usingNovedad = false;
        } else {
          await client.query("ROLLBACK");
          return res.status(409).json({
            error: "El estudiante ya se encuentra dentro del campus. La novedad solo aplica para registrar un ingreso.",
          });
        }
      }
    } else if (tipo === "SALIDA" && placa && !hasRegisteredPlate(estudiante, placa) && !matchesLastVehicle(last.rows[0], placa)) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "La moto seleccionada no coincide con la que registró el último ingreso del estudiante.",
        });
    }

    const mov = await movimientosModel.createMovimiento(client, estudianteId, tipo, {
      actorUserId: req.user?.id || null,
      vehiculoPlaca: placa || null,
    });

    let novedad = null;
    if (usingNovedad) {
      const motivo = normalizeMotivo(body.novedad?.motivo);
      const tipoSoporte = normalizeSupportType(body.novedad?.tipo_soporte);
      const observaciones = normalizarTexto(body.novedad?.observaciones) || null;

      const novedadResult = await novedadesAccesoModel.createNovedadAcceso(client, {
        movimientoId: mov.rows[0].id,
        estudianteId,
        placaObservada: placa,
        motivo,
        soporteValidado: true,
        tipoSoporte,
        observaciones,
        autorizadoPorUserId: req.user?.id || null,
      });
      novedad = novedadResult.rows[0];
    }

    await client.query("COMMIT");

    return res.status(201).json({
      message: usingNovedad ? "Ingreso con novedad registrado" : "Movimiento registrado",
      estudiante,
      movimiento: mov.rows[0],
      novedad,
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

async function listarMovimientos(_req, res, next) {
  try {
    console.log("[movimientos] GET /movimientos");
    const result = await movimientosModel.listAllMovimientos();
    return res.status(200).json({
      count: result.rows.length,
      movimientos: result.rows,
    });
  } catch (error) {
    return next(error);
  }
}

async function listarMovimientosPorEstudiante(req, res, next) {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "id de estudiante invalido" });
  }

  try {
    console.log("[movimientos] GET /movimientos/estudiante/:id", { id });
    const result = await movimientosModel.listMovimientosByEstudianteId(id);
    return res.status(200).json({
      count: result.rows.length,
      movimientos: result.rows,
    });
  } catch (error) {
    return next(error);
  }
}

async function listarDentroCampus(_req, res, next) {
  try {
    console.log("[movimientos] GET /movimientos/dentro-campus");
    const result = await movimientosModel.listDentroCampus();

    return res.status(200).json({
      count: result.rows.length,
      estudiantes: result.rows,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  registrarMovimiento,
  listarMovimientos,
  listarMovimientosPorEstudiante,
  listarDentroCampus,
};
