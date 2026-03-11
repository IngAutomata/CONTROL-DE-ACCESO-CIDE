const pool = require("../config/database");
const estudiantesModel = require("../models/estudiantes.model");
const movimientosModel = require("../models/movimientos.model");

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

function parseId(rawId) {
  const id = Number(rawId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function registrarMovimiento(req, res, next) {
  const body = req.body || {};
  const qrRaw = body.qr_uid || body.qr_url;
  const qrUid = extraerQrUid(qrRaw);

  if (!qrUid) {
    return res.status(400).json({ error: "Falta qr_uid o qr_url" });
  }

  const client = await pool.connect();

  try {
    console.log("[movimientos] POST /movimientos/registrar", { qr_uid: qrUid });
    await client.query("BEGIN");

    const est = await estudiantesModel.findByQrUidForUpdate(client, qrUid);

    if (est.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "QR no registrado", qr_uid: qrUid });
    }

    const estudiante = est.rows[0];

    if (estudiante.vigencia !== true) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Estudiante no vigente", estudiante_id: estudiante.id });
    }

    const last = await movimientosModel.getLastByEstudianteId(client, estudiante.id);

    let tipo = "ENTRADA";
    if (last.rows.length > 0 && last.rows[0].tipo === "ENTRADA") {
      tipo = "SALIDA";
    }

    const mov = await movimientosModel.createMovimiento(client, estudiante.id, tipo);

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Movimiento registrado",
      estudiante,
      movimiento: mov.rows[0],
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
