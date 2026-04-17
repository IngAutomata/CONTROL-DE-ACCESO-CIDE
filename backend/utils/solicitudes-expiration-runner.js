const pool = require("../config/database");
const solicitudesModel = require("../models/solicitudes-inscripcion.model");
const { notifySolicitudExpirada } = require("./solicitud-mailer");

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

function getExpirationIntervalMs() {
  const rawValue = Number(process.env.SOLICITUDES_EXPIRE_INTERVAL_MS || DEFAULT_INTERVAL_MS);
  if (!Number.isFinite(rawValue) || rawValue < 30000) {
    return DEFAULT_INTERVAL_MS;
  }
  return rawValue;
}

async function processExpiredSolicitudes(db = pool) {
  const result = await solicitudesModel.expirePending(db);
  const expiradas = result.rows || [];

  for (const solicitud of expiradas) {
    await notifySolicitudExpirada(solicitud);
  }

  return expiradas;
}

function startSolicitudesExpirationRunner() {
  const isEnabled = String(process.env.SOLICITUDES_EXPIRE_AUTORUN || "true").toLowerCase() !== "false";

  if (!isEnabled) {
    console.log("[solicitudes] expiración automática deshabilitada por configuración");
    return null;
  }

  const intervalMs = getExpirationIntervalMs();
  let isRunning = false;

  const runCycle = async () => {
    if (isRunning) return;

    isRunning = true;
    try {
      const expiradas = await processExpiredSolicitudes(pool);
      if (expiradas.length > 0) {
        console.log(`[solicitudes] expiración automática procesó ${expiradas.length} solicitud(es)`);
      }
    } catch (error) {
      console.error("[solicitudes] error en expiración automática", error.message);
    } finally {
      isRunning = false;
    }
  };

  setTimeout(runCycle, 10000);
  const timer = setInterval(runCycle, intervalMs);

  console.log(`[solicitudes] expiración automática activa cada ${Math.round(intervalMs / 1000)} segundos`);

  return timer;
}

module.exports = {
  getExpirationIntervalMs,
  processExpiredSolicitudes,
  startSolicitudesExpirationRunner,
};