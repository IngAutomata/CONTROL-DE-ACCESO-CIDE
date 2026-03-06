const pool = require("../config/database");

// Si llega URL completa, extrae el ultimo segmento como qr_uid.
function extraerQrUid(input) {
  if (!input || typeof input !== "string") return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  // Intenta parsear URL para ignorar query params y hash.
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1] : null;
  } catch (_) {
    // Si no es URL valida, procesa como token/path simple.
  }

  const sinQueryNiHash = trimmed.split(/[?#]/)[0];
  const parts = sinQueryNiHash.split("/").filter(Boolean);

  if (parts.length > 0) {
    return parts[parts.length - 1];
  }

  return null;
}

async function registrarMovimiento(req, res) {
  const qrRaw = req.body.qr_uid || req.body.qr_url;
  const qrUid = extraerQrUid(qrRaw);

  if (!qrUid) {
    return res.status(400).json({ error: "Falta qr_uid o qr_url" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Bloquea fila de estudiante para serializar movimientos por usuario.
    const est = await client.query(
      "SELECT id, documento, nombre, carrera, vigencia FROM estudiantes WHERE qr_uid = $1 FOR UPDATE",
      [qrUid]
    );

    if (est.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "QR no registrado", qr_uid: qrUid });
    }

    const estudiante = est.rows[0];

    const last = await client.query(
      "SELECT tipo FROM movimientos WHERE estudiante_id = $1 ORDER BY fecha DESC, id DESC LIMIT 1",
      [estudiante.id]
    );

    let tipo = "ENTRADA";
    if (last.rows.length > 0 && last.rows[0].tipo === "ENTRADA") {
      tipo = "SALIDA";
    }

    const mov = await client.query(
      "INSERT INTO movimientos (estudiante_id, tipo) VALUES ($1, $2) RETURNING id, tipo, fecha",
      [estudiante.id, tipo]
    );

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
      // No-op: evita ocultar el error original si falla rollback.
    }

    console.error(error);
    return res.status(500).json({ error: "Error registrando movimiento" });
  } finally {
    client.release();
  }
}

async function listarDentroCampus(req, res) {
  try {
    const result = await pool.query(
      `
      WITH ultimo_movimiento AS (
        SELECT DISTINCT ON (m.estudiante_id)
          m.estudiante_id,
          m.tipo,
          m.fecha
        FROM movimientos m
        ORDER BY m.estudiante_id, m.fecha DESC, m.id DESC
      )
      SELECT
        e.id AS estudiante_id,
        e.documento,
        e.nombre,
        e.carrera,
        e.vigencia,
        moto.placa,
        moto.color,
        um.tipo AS ultimo_movimiento,
        um.fecha AS fecha_ultimo_movimiento
      FROM ultimo_movimiento um
      JOIN estudiantes e ON e.id = um.estudiante_id
      LEFT JOIN motocicletas moto ON moto.estudiante_id = e.id
      WHERE um.tipo = 'ENTRADA'
      ORDER BY um.fecha DESC
      `
    );

    return res.status(200).json({
      count: result.rows.length,
      estudiantes: result.rows,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error consultando estudiantes dentro del campus" });
  }
}

module.exports = { registrarMovimiento, listarDentroCampus };
