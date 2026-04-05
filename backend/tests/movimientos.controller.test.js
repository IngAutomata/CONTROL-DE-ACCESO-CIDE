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

  await runTest("registrarMovimiento permite registrar por documento", async () => {
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
            rows: [{ id: 15, documento: "12345678", nombre: "Luis", carrera: "Ing", vigencia: true }],
          };
        },
      },
      movimientosModelMock: {
        getLastByEstudianteId: async () => ({ rows: [] }),
        createMovimiento: async (_client, estudianteId, tipo, audit) => {
          calls.push({ op: "createMovimiento", estudianteId, tipo, audit });
          return { rows: [{ id: 91, estudiante_id: estudianteId, tipo, fecha_hora: "2026-04-04T16:00:00.000Z" }] };
        },
      },
    });

    const req = {
      user: { id: 42, username: "guarda", role: "GUARDA" },
      body: { documento: "12345678" },
    };
    const res = createRes();

    await registrarMovimiento(req, res, () => {});

    assert.equal(res.statusCode, 201);
    assert.ok(calls.some((c) => c.op === "findByDocumentoForUpdate" && c.documento === "12345678"));
    assert.ok(calls.some((c) => c.op === "createMovimiento" && c.estudianteId === 15 && c.tipo === "ENTRADA"));
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
            rows: [{ id: 19, documento: "12345678", nombre: "Luis", carrera: "Ing", vigencia: true }],
          };
        },
      },
      movimientosModelMock: {
        getLastByEstudianteId: async () => ({ rows: [] }),
        createMovimiento: async (_client, estudianteId, tipo) => {
          calls.push({ op: "createMovimiento", estudianteId, tipo });
          return { rows: [{ id: 92, estudiante_id: estudianteId, tipo, fecha_hora: "2026-04-04T16:00:00.000Z" }] };
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
          return { rows: [{ id: 77, estudiante_id: estudianteId, tipo, fecha_hora: "2026-03-05T15:00:00.000Z" }] };
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
          rows: [{ id: 88, estudiante_id: estudianteId, tipo, fecha_hora: "2026-04-04T16:00:00.000Z" }],
        }),
      },
    });

    const req = {
      body: {
        qr_uid: "https://soe.cide.edu.co/verificar-estudiante/NjEyMzE2",
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
          c.candidates.includes("https://soe.cide.edu.co/verificar-estudiante/NjEyMzE2") &&
          c.candidates.includes("NjEyMzE2")
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
          rows: [{ id: 88, estudiante_id: estudianteId, tipo, fecha_hora: "2026-04-04T16:00:00.000Z" }],
        }),
      },
    });

    const req = {
      body: {
        qr_uid: "https://soe.cide.edu.co/verificar-estudiante/NjEyMzE2",
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
          c.candidates.includes("https://soe.cide.edu.co/verificar-estudiante/NjEyMzE2") &&
          c.candidates.includes("NjEyMzE2")
      )
    );
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
