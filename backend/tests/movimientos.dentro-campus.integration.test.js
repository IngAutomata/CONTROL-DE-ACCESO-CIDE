const assert = require("node:assert/strict");
const pool = require("../config/database");
const { listarDentroCampus } = require("../controllers/movimientos.controller");

function createRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

async function run() {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const base = `it_${suffix}`;

  const studentsSeed = [
    {
      documento: `${base}_A`,
      qr_uid: `${base}_QR_A`,
      nombre: "Alumno A",
      carrera: "Ingenieria A",
      vigencia: true,
      placa: "AAA111",
      color: "Negro",
    },
    {
      documento: `${base}_B`,
      qr_uid: `${base}_QR_B`,
      nombre: "Alumno B",
      carrera: "Ingenieria B",
      vigencia: false,
      placa: "BBB222",
      color: "Rojo",
    },
    {
      documento: `${base}_C`,
      qr_uid: `${base}_QR_C`,
      nombre: "Alumno C",
      carrera: "Ingenieria C",
      vigencia: true,
      placa: "CCC333",
      color: "Azul",
    },
    {
      documento: `${base}_D`,
      qr_uid: `${base}_QR_D`,
      nombre: "Alumno D",
      carrera: "Ingenieria D",
      vigencia: true,
    },
  ];

  const createdStudentIds = [];

  try {
    // Seed estudiantes
    for (const s of studentsSeed) {
      const est = await pool.query(
        `
        INSERT INTO estudiantes (documento, qr_uid, nombre, carrera, vigencia)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
        `,
        [s.documento, s.qr_uid, s.nombre, s.carrera, s.vigencia]
      );

      const estudianteId = est.rows[0].id;
      createdStudentIds.push(estudianteId);

      if (s.placa && s.color) {
        await pool.query(
          `
          INSERT INTO motocicletas (estudiante_id, placa, color)
          VALUES ($1, $2, $3)
          `,
          [estudianteId, s.placa, s.color]
        );
      }
    }

    const [idA, idB, idC, idD] = createdStudentIds;

    // Seed movimientos
    // A: ENTRADA -> SALIDA -> ENTRADA (debe aparecer)
    await pool.query("INSERT INTO movimientos (estudiante_id, tipo, fecha) VALUES ($1, $2, $3)", [idA, "ENTRADA", "2026-03-05 08:00:00"]);
    await pool.query("INSERT INTO movimientos (estudiante_id, tipo, fecha) VALUES ($1, $2, $3)", [idA, "SALIDA", "2026-03-05 10:00:00"]);
    await pool.query("INSERT INTO movimientos (estudiante_id, tipo, fecha) VALUES ($1, $2, $3)", [idA, "ENTRADA", "2026-03-05 12:00:00"]);

    // B: ENTRADA -> SALIDA (no debe aparecer)
    await pool.query("INSERT INTO movimientos (estudiante_id, tipo, fecha) VALUES ($1, $2, $3)", [idB, "ENTRADA", "2026-03-05 07:30:00"]);
    await pool.query("INSERT INTO movimientos (estudiante_id, tipo, fecha) VALUES ($1, $2, $3)", [idB, "SALIDA", "2026-03-05 09:30:00"]);

    // C: sin movimientos (no debe aparecer)

    // D: ENTRADA (debe aparecer, sin moto para validar nullables)
    await pool.query("INSERT INTO movimientos (estudiante_id, tipo, fecha) VALUES ($1, $2, $3)", [idD, "ENTRADA", "2026-03-05 13:00:00"]);

    // Ejecutar controlador real contra DB
    const req = {};
    const res = createRes();
    await listarDentroCampus(req, res);

    assert.equal(res.statusCode, 200, "Debe responder 200");
    assert.ok(Array.isArray(res.body.estudiantes), "Debe devolver array de estudiantes");

    const docs = new Set(res.body.estudiantes.map((e) => e.documento));

    assert.equal(docs.has(`${base}_A`), true, "A debe estar dentro");
    assert.equal(docs.has(`${base}_D`), true, "D debe estar dentro");
    assert.equal(docs.has(`${base}_B`), false, "B no debe estar dentro");
    assert.equal(docs.has(`${base}_C`), false, "C no debe estar dentro");

    const estudianteD = res.body.estudiantes.find((e) => e.documento === `${base}_D`);
    assert.equal(estudianteD.placa, null, "Placa de D debe ser null");
    assert.equal(estudianteD.color, null, "Color de D debe ser null");

    assert.equal(estudianteD.ultimo_movimiento, "ENTRADA", "Ultimo movimiento de D debe ser ENTRADA");

    // Orden esperado: D (13:00) primero, luego A (12:00)
    const firstTwo = res.body.estudiantes
      .filter((e) => e.documento === `${base}_D` || e.documento === `${base}_A`)
      .slice(0, 2)
      .map((e) => e.documento);

    assert.deepEqual(firstTwo, [`${base}_D`, `${base}_A`], "Debe ordenar por fecha_ultimo_movimiento DESC");

    console.log("PASS integration: dentro-campus con PostgreSQL real");
  } finally {
    if (createdStudentIds.length > 0) {
      await pool.query("DELETE FROM movimientos WHERE estudiante_id = ANY($1::int[])", [createdStudentIds]);
      await pool.query("DELETE FROM motocicletas WHERE estudiante_id = ANY($1::int[])", [createdStudentIds]);
      await pool.query("DELETE FROM estudiantes WHERE id = ANY($1::int[])", [createdStudentIds]);
    }

    await pool.end();
  }
}

run().catch((error) => {
  console.error("FAIL integration: dentro-campus", error);
  process.exit(1);
});
