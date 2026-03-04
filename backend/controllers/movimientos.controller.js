const pool = require("../config/database");

// Si llega URL completa, extrae el ultimo segmento como qr_uid
function extraerQrUid(input) {
  if (!input) return null;

  if (input.includes("/")) {
    const parts = input.split("/").filter(Boolean);
    return parts[parts.length - 1];
  }

  return input; // si ya es el token
}

async function registrarMovimiento(req, res) {
  try {
    const qr_raw = req.body.qr_uid || req.body.qr_url;
    const qr_uid = extraerQrUid(qr_raw);

    if (!qr_uid) {
      return res.status(400).json({ error: "Falta qr_uid o qr_url" });
    }

    // 1) Buscar estudiante por qr_uid
    const est = await pool.query(
      "SELECT id, documento, nombre, carrera, vigencia FROM estudiantes WHERE qr_uid = $1",
      [qr_uid]
    );

    if (est.rows.length === 0) {
      return res.status(404).json({ error: "QR no registrado", qr_uid });
    }

    const estudiante = est.rows[0];

    // 2) Buscar ultimo movimiento (tu columna es 'fecha')
    const last = await pool.query(
      "SELECT tipo FROM movimientos WHERE estudiante_id = $1 ORDER BY fecha DESC LIMIT 1",
      [estudiante.id]
    );

    let tipo = "ENTRADA";
    if (last.rows.length > 0 && last.rows[0].tipo === "ENTRADA") {
      tipo = "SALIDA";
    }

    // 3) Insertar movimiento (la fecha se pone sola con DEFAULT now())
    const mov = await pool.query(
      "INSERT INTO movimientos (estudiante_id, tipo) VALUES ($1, $2) RETURNING id, tipo, fecha",
      [estudiante.id, tipo]
    );

    return res.status(201).json({
      message: "Movimiento registrado",
      estudiante,
      movimiento: mov.rows[0],
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error registrando movimiento" });
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
