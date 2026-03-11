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

function loadController({ poolMock, estudiantesModelMock, movimientosModelMock }) {
  const dbPath = path.resolve(__dirname, "../config/database.js");
  const estModelPath = path.resolve(__dirname, "../models/estudiantes.model.js");
  const movModelPath = path.resolve(__dirname, "../models/movimientos.model.js");
  const controllerPath = path.resolve(__dirname, "../controllers/movimientos.controller.js");

  delete require.cache[dbPath];
  delete require.cache[estModelPath];
  delete require.cache[movModelPath];
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
  await runTest("registrarMovimiento exige qr_uid o qr_url", async () => {
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
    assert.deepEqual(res.body, { error: "Falta qr_uid o qr_url" });
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

    const req = { body: { qr_uid: "QR001" } };
    const res = createRes();

    await registrarMovimiento(req, res, () => {});

    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, { error: "Estudiante no vigente", estudiante_id: 10 });
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
        createMovimiento: async (_client, estudianteId, tipo) => {
          calls.push({ op: "createMovimiento", estudianteId, tipo });
          return { rows: [{ id: 77, estudiante_id: estudianteId, tipo, fecha_hora: "2026-03-05T15:00:00.000Z" }] };
        },
      },
    });

    const req = {
      body: {
        qr_url: "https://cide.edu/qr/QR001?source=lector#abc",
      },
    };
    const res = createRes();

    await registrarMovimiento(req, res, () => {});

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.movimiento.tipo, "SALIDA");
    assert.ok(calls.some((c) => c.op === "findByQrUidForUpdate" && c.qrUid === "QR001"));
    assert.ok(calls.some((c) => c.op === "createMovimiento" && c.estudianteId === 10 && c.tipo === "SALIDA"));
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
