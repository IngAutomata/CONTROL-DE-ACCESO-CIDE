const pool = require("../config/database");

async function primerIngreso(req, res) {
  const { documento, qr_uid, nombre, carrera, vigencia, placa, color } = req.body;

  // Validacion minima
  if (!documento || !qr_uid || !nombre || !carrera || typeof vigencia !== "boolean" || !placa || !color) {
    return res.status(400).json({ error: "Faltan datos requeridos o vigencia no es boolean" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Upsert estudiante
    const estudianteResult = await client.query(
      `
      INSERT INTO estudiantes (documento, qr_uid, nombre, carrera, vigencia)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (documento)
      DO UPDATE SET qr_uid = EXCLUDED.qr_uid, nombre = EXCLUDED.nombre, carrera = EXCLUDED.carrera, vigencia = EXCLUDED.vigencia
      RETURNING id, documento, qr_uid, nombre, carrera, vigencia
      `,
      [documento, qr_uid, nombre, carrera, vigencia]
    );

    const estudiante = estudianteResult.rows[0];

    // Upsert moto (1:1 por MVP)
    await client.query(
      `
      INSERT INTO motocicletas (estudiante_id, placa, color)
      VALUES ($1, $2, $3)
      ON CONFLICT (estudiante_id)
      DO UPDATE SET placa = EXCLUDED.placa, color = EXCLUDED.color
      `,
      [estudiante.id, placa, color]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Primer ingreso registrado",
      estudiante,
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {
      // No-op: evita ocultar el error original si falla rollback.
    }

    console.error(err);
    return res.status(500).json({ error: "Error registrando primer ingreso" });
  } finally {
    client.release();
  }
}

async function obtenerPorDocumento(req, res) {
  const { documento } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT
        e.id AS estudiante_id,
        e.documento,
        e.qr_uid,
        e.nombre,
        e.carrera,
        e.vigencia,
        m.placa,
        m.color
      FROM estudiantes e
      LEFT JOIN motocicletas m ON m.estudiante_id = e.id
      WHERE e.documento = $1
      `,
      [documento]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Estudiante no encontrado" });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error consultando estudiante" });
  }
}

module.exports = { primerIngreso, obtenerPorDocumento };
