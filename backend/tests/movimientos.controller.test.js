const assert = require("node:assert/strict");
const path = require("node:path");

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

function loadController({ poolMock, estudiantesModelMock, movimientosModelMock, novedadesModelMock }) {
  const dbPath = path.resolve(__dirname, "../config/database.js");
  const estModelPath = path.resolve(__dirname, "../models/estudiantes.model.js");
  const movModelPath = path.resolve(__dirname, "../models/movimientos.model.js");
  const novModelPath = path.resolve(__dirname, "../models/novedades-acceso.model.js");
  const controllerPath = path.resolve(__dirname, "../controllers/movimientos.controller.js");

  delete require.cache[dbPath];
  delete require.cache[estModelPath];
  delete require.cache[movModelPath];
  delete require.cache[novModelPath];
  delete require.cache[controllerPath];

  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: poolMock,
  };

  require.cache[estModelPath] = {
    id: estModelPath,
    filename: estModelPath,
    loaded: true,
    exports: estudiantesModelMock,
  };

  require.cache[movModelPath] = {
    id: movModelPath,
    filename: movModelPath,
    loaded: true,
    exports: movimientosModelMock,
  };

  require.cache[novModelPath] = {
    id: novModelPath,
    filename: novModelPath,
    loaded: true,
    exports: novedadesModelMock || {
      createNovedadAcceso: async () => ({ rows: [] }),
      findByMovimientoId: async () => ({ rows: [] }),
    },
  };

  return require(controllerPath);
}

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

(async () => {
  const VALID_QR = "https://soe.cide.edu.co/verificar-estudiante/NjEyMzE2";

  await runTest("registrarMovimiento exige qr_uid, qr_url, documento o placa", async () => {
    const { registrarMovimiento } = loadController({
      poolMock: {
        connect: async () => ({ query: async () => ({ rows: [] }), release() {} }),
      },
      estudiantesModelMock: {
        findByQrUidForUpdate: async () => ({ rows: [] }),
      },
      movimientosModelMock: {
        getLastByEstudianteId: async () => ({ rows: [] }),
        createMovimiento: async () => ({ rows: [] }),
      },
    });

    const req = { body: {} };
    const res = createRes();

    await registrarMovimiento(req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: "Falta qr_uid, qr_url, documento o placa" });
  });

  await runTest("registrarMovimiento rechaza qr fuera de estructura CIDE", async () => {
    const { registrarMovimiento } = loadController({
      poolMock: {
        connect: async () => ({ query: async () => ({ rows: [] }), release() {} }),
      },
      estudiantesModelMock: {
        findByQrUidForUpdate: async () => ({ rows: [] }),
      },
      movimientosModelMock: {
        getLastByEstudianteId: async () => ({ rows: [] }),
        createMovimiento: async () => ({ rows: [] }),
      },
    });

    const req = { body: { qr_uid: "QR001" } };
    const res = createRes();

    await registrarMovimiento(req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: "qr_uid debe tener formato QR de CIDE" });
  });

  await runTest("registrarMovimiento retorna 403 si estudiante no vigente", async () => {
    const client = { query: async () => ({ rows: [] }), release() {} };

    const { registrarMovimiento } = loadController({
      poolMock: {
        connect: async () => client,
      },
      estudiantesModelMock: {
        findByQrUidForUpdate: async () => ({
          rows: [{ id: 10, documento: "123", nombre: "Luis", carrera: "Ing", vigencia: false }],
        }),
      },
      movimientosModelMock: {
        getLastByEstudianteId: async () => ({ rows: [] }),
        createMovimiento: async () => ({ rows: [] }),
      },
    });

    const req = { body: { qr_uid: VALID_QR } };
    const res = createRes();

    await registrarMovimiento(req, res, () => {});

    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, { error: "Estudiante no vigente", estudiante_id: 10 });
  });

  await runTest("registrarMovimiento exige moto al registrar por documento", async () => {
    const client = {
      query: async () => ({ rows: [] }),
      release() {},
    };

    const { registrarMovimiento } = loadController({
      poolMock: {
        connect: async () => client,
      },
      estudiantesModelMock: {},
      movimientosModelMock: {
        getLastByEstudianteId: async () => ({ rows: [] }),
        createMovimiento: async () => ({ rows: [] }),
      },
    });

    const req = {
      user: { id: 42, username: "guarda", role: "GUARDA" },
      body: { documento: "12345678" },
    };
    const res = createRes();

    await registrarMovimiento(req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, {
      error: "Cuando registras por cédula debes indicar con cuál moto ingresa el estudiante.",
    });
  });

  await runTest("registrarMovimiento permite registrar por documento con moto seleccionada", async () => {
    const calls = [];
    const client = {
      query: async () => ({ rows: [] }),
      release() {},
    };

    const { registrarMovimiento } = loadController({
      poolMock: {
        connect: async () => client,
      },
      estudiantesModelMock: {
        findByDocumentoForUpdate: async (_client, documento) => {
          calls.push({ op: "findByDocumentoForUpdate", documento });
          return {
            rows: [{
              id: 15,
              documento: "12345678",
              nombre: "Luis",
              carrera: "Ing",
              vigencia: true,
              motos: [{ placa: "ABC12D", is_active: true }],
            }],
          };
        },
      },
      movimientosModelMock: {
        getLastByEstudianteId: async () => ({ rows: [] }),
        createMovimiento: async (_client, estudianteId, tipo, audit) => {
          calls.push({ op: "createMovimiento", estudianteId, tipo, audit });
          return {
            rows: [{
              id: 91,
              estudiante_id: estudianteId,
              tipo,
              vehiculo_placa: audit.vehiculoPlaca,
              fecha_hora: "2026-04-04T16:00:00.000Z",
            }],
          };
        },
      },
    });

    const req = {
      user: { id: 42, username: "guarda", role: "GUARDA" },
      body: { documento: "12345678", placa: "abc12d" },
    };
    const res = createRes();

    await registrarMovimiento(req, res, () => {});

    assert.equal(res.statusCode, 201);
    assert.ok(calls.some((c) => c.op === "findByDocumentoForUpdate" && c.documento === "12345678"));
    assert.ok(
      calls.some(
        (c) =>
          c.op === "createMovimiento" &&
          c.estudianteId === 15 &&
          c.tipo === "ENTRADA" &&
          c.audit?.vehiculoPlaca === "ABC12D"
      )
    );
  });

  await runTest("registrarMovimiento rechaza moto no registrada por documento sin novedad", async () => {
    const client = {
      query: async () => ({ rows: [] }),
      release() {},
    };

    const { registrarMovimiento } = loadController({
      poolMock: { connect: async () => client },
      estudiantesModelMock: {
        findByDocumentoForUpdate: async () => ({
          rows: [{
            id: 15,
            documento: "12345678",
            nombre: "Luis",
            carrera: "Ing",
            vigencia: true,
            motos: [{ placa: "ABC12D", is_active: true }],
          }],
        }),
      },
      movimientosModelMock: {
        getLastByEstudianteId: async () => ({ rows: [] }),
        createMovimiento: async () => ({ rows: [] }),
      },
    });

    const req = {
      user: { id: 42, username: "guarda", role: "GUARDA" },
      body: { documento: "12345678", placa: "zzz99z" },
    };
    const res = createRes();

    await registrarMovimiento(req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, {
      error: "La moto seleccionada no está registrada para este estudiante. Debes registrar el ingreso con novedad.",
    });
  });

  await runTest("registrarMovimiento permite registrar por placa", async () => {
    const calls = [];
    const client = {
      query: async () => ({ rows: [] }),
      release() {},
    };

    const { registrarMovimiento } = loadController({
      poolMock: {
        connect: async () => client,
      },
      estudiantesModelMock: {
        findByPlacaForUpdate: async (_client, placa) => {
          calls.push({ op: "findByPlacaForUpdate", placa });
          return {
            rows: [{ id: 19, documento: "12345678", nombre: "Luis", carrera: "Ing", vigencia: true, motos: [{ placa: "ABC12D", is_active: true }] }],
          };
        },
      },
      movimientosModelMock: {
        getLastByEstudianteId: async () => ({ rows: [] }),
        createMovimiento: async (_client, estudianteId, tipo) => {
          calls.push({ op: "createMovimiento", estudianteId, tipo });
          return {
            rows: [{ id: 92, estudiante_id: estudianteId, tipo, vehiculo_placa: "ABC12D", fecha_hora: "2026-04-04T16:00:00.000Z" }],
          };
        },
      },
    });

    const req = {
      body: { placa: "abc12d" },
    };
    const res = createRes();

    await registrarMovimiento(req, res, () => {});

    assert.equal(res.statusCode, 201);
    assert.ok(calls.some((c) => c.op === "findByPlacaForUpdate" && c.placa === "ABC12D"));
    assert.ok(calls.some((c) => c.op === "createMovimiento" && c.estudianteId === 19 && c.tipo === "ENTRADA"));
  });

  await runTest("registrarMovimiento alterna a SALIDA cuando ultimo movimiento fue ENTRADA", async () => {
    const calls = [];
    const client = {
      query: async (sql, params) => {
        calls.push({ sql, params });
        return { rows: [] };
      },
      release() {},
    };

    const { registrarMovimiento } = loadController({
      poolMock: {
        connect: async () => client,
      },
      estudiantesModelMock: {
        findByQrUidForUpdate: async (_client, qrUid) => {
          calls.push({ op: "findByQrUidForUpdate", qrUid });
          return {
            rows: [{ id: 10, documento: "123", nombre: "Luis", carrera: "Ing", vigencia: true }],
          };
        },
      },
      movimientosModelMock: {
        getLastByEstudianteId: async (_client, estudianteId) => {
          calls.push({ op: "getLastByEstudianteId", estudianteId });
          return { rows: [{ tipo: "ENTRADA" }] };
        },
        createMovimiento: async (_client, estudianteId, tipo, audit) => {
          calls.push({ op: "createMovimiento", estudianteId, tipo, audit });
          return { rows: [{ id: 77, estudiante_id: estudianteId, tipo, vehiculo_placa: null, fecha_hora: "2026-03-05T15:00:00.000Z" }] };
        },
      },
    });

    const req = {
      user: { id: 42, username: "guarda", role: "GUARDA" },
      body: {
        qr_url: VALID_QR,
      },
    };
    const res = createRes();

    await registrarMovimiento(req, res, () => {});

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.movimiento.tipo, "SALIDA");
    assert.ok(calls.some((c) => c.op === "findByQrUidForUpdate" && c.qrUid === "NjEyMzE2"));
    assert.ok(
      calls.some(
        (c) =>
          c.op === "createMovimiento" &&
          c.estudianteId === 10 &&
          c.tipo === "SALIDA" &&
          c.audit?.actorUserId === 42
      )
    );
  });

  await runTest("registrarMovimiento acepta qr_url completo cuando el estudiante guarda la URL completa", async () => {
    const calls = [];
    const client = {
      query: async () => ({ rows: [] }),
      release() {},
    };

    const { registrarMovimiento } = loadController({
      poolMock: {
        connect: async () => client,
      },
      estudiantesModelMock: {
        findByQrCandidatesForUpdate: async (_client, candidates) => {
          calls.push({ op: "findByQrCandidatesForUpdate", candidates });
          return {
            rows: [{ id: 81, documento: "1016034712", nombre: "CRISTIAN SALAZAR", carrera: "Ing", vigencia: true }],
          };
        },
      },
      movimientosModelMock: {
        getLastByEstudianteId: async () => ({ rows: [] }),
        createMovimiento: async (_client, estudianteId, tipo) => ({
          rows: [{ id: 88, estudiante_id: estudianteId, tipo, vehiculo_placa: null, fecha_hora: "2026-04-04T16:00:00.000Z" }],
        }),
      },
    });

    const req = {
      body: {
        qr_uid: VALID_QR,
      },
    };
    const res = createRes();

    await registrarMovimiento(req, res, () => {});

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.movimiento.tipo, "ENTRADA");
    assert.ok(
      calls.some(
        (c) =>
          c.op === "findByQrCandidatesForUpdate" &&
          c.candidates.includes(VALID_QR) &&
          c.candidates.includes("NjEyMzE2")
      )
    );
  });

  await runTest("registrarMovimiento registra ingreso con novedad para moto no registrada", async () => {
    const calls = [];
    const client = {
      query: async () => ({ rows: [] }),
      release() {},
    };

    const { registrarMovimiento } = loadController({
      poolMock: { connect: async () => client },
      estudiantesModelMock: {
        findByDocumentoForUpdate: async (_client, documento) => {
          calls.push({ op: "findByDocumentoForUpdate", documento });
          return {
            rows: [{
              id: 25,
              documento: "12345678",
              nombre: "Laura Novedad",
              carrera: "Ing",
              vigencia: true,
              motos: [{ placa: "ABC12D", is_active: true }],
            }],
          };
        },
      },
      movimientosModelMock: {
        getLastByEstudianteId: async () => ({ rows: [] }),
        createMovimiento: async (_client, estudianteId, tipo, audit) => {
          calls.push({ op: "createMovimiento", estudianteId, tipo, audit });
          return {
            rows: [{
              id: 120,
              estudiante_id: estudianteId,
              tipo,
              vehiculo_placa: audit.vehiculoPlaca,
              fecha_hora: "2026-04-16T08:00:00.000Z",
              actor_username: "admin",
            }],
          };
        },
      },
      novedadesModelMock: {
        createNovedadAcceso: async (_client, payload) => {
          calls.push({ op: "createNovedadAcceso", payload });
          return { rows: [{ id: 1, movimiento_id: 120, ...payload }] };
        },
      },
    });

    const req = {
      user: { id: 1, username: "admin", role: "ADMIN" },
      body: {
        placa: "zzz99z",
        documento: "12345678",
        novedad: {
          motivo: "Vehículo alterno del estudiante",
          tipo_soporte: "RUNT",
          soporte_validado: true,
          observaciones: "Validado por plataforma.",
        },
      },
    };
    const res = createRes();

    await registrarMovimiento(req, res, () => {});

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.message, "Ingreso con novedad registrado");
    assert.equal(res.body.movimiento.tipo, "ENTRADA");
    assert.ok(calls.some((c) => c.op === "findByDocumentoForUpdate" && c.documento === "12345678"));
    assert.ok(calls.some((c) => c.op === "createNovedadAcceso" && c.payload.placaObservada === "ZZZ99Z" && c.payload.tipoSoporte === "RUNT"));
  });

  await runTest("registrarMovimiento permite salida por cédula con la placa de una novedad previa", async () => {
    const client = {
      query: async () => ({ rows: [] }),
      release() {},
    };

    const { registrarMovimiento } = loadController({
      poolMock: { connect: async () => client },
      estudiantesModelMock: {
        findByDocumentoForUpdate: async () => ({
          rows: [{
            id: 25,
            estudiante_id: 25,
            documento: "12345678",
            nombre: "Laura Novedad",
            carrera: "Ing",
            vigencia: true,
            motos: [{ placa: "ABC12D", is_active: true }],
          }],
        }),
      },
      movimientosModelMock: {
        getLastByEstudianteId: async () => ({ rows: [{ tipo: "ENTRADA", vehiculo_placa: "ZZZ99Z" }] }),
        createMovimiento: async (_client, estudianteId, tipo, audit) => ({
          rows: [{
            id: 121,
            estudiante_id: estudianteId,
            tipo,
            vehiculo_placa: audit.vehiculoPlaca,
            fecha_hora: "2026-04-16T09:00:00.000Z",
          }],
        }),
      },
    });

    const req = {
      user: { id: 1, username: "admin", role: "ADMIN" },
      body: {
        documento: "12345678",
        placa: "ZZZ99Z",
      },
    };
    const res = createRes();

    await registrarMovimiento(req, res, () => {});

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.movimiento.tipo, "SALIDA");
    assert.equal(res.body.novedad, null);
  });

  await runTest("registrarMovimiento permite salida por placa cuando corresponde a una novedad activa", async () => {
    const client = {
      query: async () => ({ rows: [] }),
      release() {},
    };

    const { registrarMovimiento } = loadController({
      poolMock: { connect: async () => client },
      estudiantesModelMock: {
        findByPlacaForUpdate: async () => ({ rows: [] }),
      },
      movimientosModelMock: {
        findCurrentInsideByPlateForUpdate: async (_client, placa) => ({
          rows: [{
            id: 25,
            estudiante_id: 25,
            documento: "12345678",
            nombre: "Laura Novedad",
            carrera: "Ing",
            vigencia: true,
            motos: [{ placa: "ABC12D", is_active: true }],
            placa_movimiento_actual: placa,
          }],
        }),
        getLastByEstudianteId: async () => ({ rows: [{ tipo: "ENTRADA", vehiculo_placa: "ZZZ99Z" }] }),
        createMovimiento: async (_client, estudianteId, tipo, audit) => ({
          rows: [{
            id: 122,
            estudiante_id: estudianteId,
            tipo,
            vehiculo_placa: audit.vehiculoPlaca,
            fecha_hora: "2026-04-16T09:10:00.000Z",
          }],
        }),
      },
    });

    const req = {
      user: { id: 1, username: "admin", role: "ADMIN" },
      body: {
        placa: "ZZZ99Z",
      },
    };
    const res = createRes();

    await registrarMovimiento(req, res, () => {});

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.movimiento.tipo, "SALIDA");
  });

  await runTest("registrarMovimiento exige observación cuando el motivo es Otro", async () => {
    const client = {
      query: async () => ({ rows: [] }),
      release() {},
    };

    const { registrarMovimiento } = loadController({
      poolMock: { connect: async () => client },
      estudiantesModelMock: {
        findByDocumentoForUpdate: async () => ({
          rows: [{ id: 25, documento: "12345678", nombre: "Laura Novedad", carrera: "Ing", vigencia: true, motos: [] }],
        }),
      },
      movimientosModelMock: {
        getLastByEstudianteId: async () => ({ rows: [] }),
        createMovimiento: async () => ({ rows: [] }),
      },
    });

    const req = {
      user: { id: 1, username: "admin", role: "ADMIN" },
      body: {
        placa: "zzz99z",
        documento: "12345678",
        novedad: {
          motivo: "Otro",
          tipo_soporte: "RUNT",
          soporte_validado: true,
          observaciones: "",
        },
      },
    };
    const res = createRes();

    await registrarMovimiento(req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: "Debes agregar una observación cuando eliges 'Otro'." });
  });

  await runTest("listarDentroCampus retorna 200 con count y estudiantes", async () => {
    const fakeRows = [
      {
        estudiante_id: 1,
        documento: "123456",
        nombre: "Luis Ramon",
        carrera: "Ingenieria Mecatronica",
        vigencia: true,
        placa: "ABC123",
        color: "Negro",
        ultimo_movimiento: "ENTRADA",
        fecha_ultimo_movimiento: "2026-03-04T14:10:00.000Z",
      },
    ];

    const { listarDentroCampus } = loadController({
      poolMock: {},
      estudiantesModelMock: {},
      movimientosModelMock: {
        listDentroCampus: async () => ({ rows: fakeRows }),
      },
    });

    const req = {};
    const res = createRes();

    await listarDentroCampus(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      count: 1,
      estudiantes: fakeRows,
    });
  });

  await runTest("listarDentroCampus llama next(error) cuando falla la consulta", async () => {
    const boom = new Error("DB down");

    const { listarDentroCampus } = loadController({
      poolMock: {},
      estudiantesModelMock: {},
      movimientosModelMock: {
        listDentroCampus: async () => {
          throw boom;
        },
      },
    });

    const req = {};
    const res = createRes();
    let nextError = null;

    await listarDentroCampus(req, res, (err) => {
      nextError = err;
    });

    assert.equal(res.body, null);
    assert.equal(nextError, boom);
  });

  if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
  }

  console.log("All tests passed");
})();
