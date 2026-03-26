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

function loadController({ poolMock, estudiantesModelMock, auditoriaModelMock }) {
  const dbPath = path.resolve(__dirname, "../config/database.js");
  const modelPath = path.resolve(__dirname, "../models/estudiantes.model.js");
  const auditModelPath = path.resolve(__dirname, "../models/auditoria.model.js");
  const controllerPath = path.resolve(__dirname, "../controllers/estudiantes.controller.js");

  delete require.cache[dbPath];
  delete require.cache[modelPath];
  delete require.cache[auditModelPath];
  delete require.cache[controllerPath];

  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: poolMock,
  };

  require.cache[modelPath] = {
    id: modelPath,
    filename: modelPath,
    loaded: true,
    exports: estudiantesModelMock,
  };

  require.cache[auditModelPath] = {
    id: auditModelPath,
    filename: auditModelPath,
    loaded: true,
    exports: auditoriaModelMock || {
      createAuditLog: async () => ({ rows: [{ id: 1 }] }),
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
  await runTest("primerIngreso exige qr_uid", async () => {
    const { primerIngreso } = loadController({
      poolMock: {
        connect: async () => ({
          query: async () => ({ rows: [] }),
          release() {},
        }),
      },
      estudiantesModelMock: {
        upsertPrimerIngreso: async () => {
          throw new Error("No debe llamarse en validacion");
        },
      },
      auditoriaModelMock: {},
    });

    const req = {
      body: {
        documento: "123456",
        nombre: "Luis",
        carrera: "Ing",
        vigencia: true,
        placa: "ABC123",
        color: "Negro",
      },
    };
    const res = createRes();

    await primerIngreso(req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: "Faltan datos requeridos o vigencia no es boolean" });
  });

  await runTest("primerIngreso hace upsert incluyendo qr_uid y audita", async () => {
    const queries = [];
    const client = {
      query: async (sql) => {
        queries.push(sql);
        return { rows: [] };
      },
      release() {},
    };

    const fakeResult = {
      estudiante: {
        id: 1,
        documento: "123456",
        qr_uid: "QR001",
        nombre: "Luis",
        carrera: "Ing",
        vigencia: true,
      },
      estudianteWasCreated: true,
      motoWasCreated: true,
    };

    let payloadSeen = null;
    let auditCount = 0;

    const { primerIngreso } = loadController({
      poolMock: {
        connect: async () => client,
      },
      estudiantesModelMock: {
        upsertPrimerIngreso: async (_client, payload) => {
          payloadSeen = payload;
          return fakeResult;
        },
      },
      auditoriaModelMock: {
        createAuditLog: async () => {
          auditCount += 1;
          return { rows: [{ id: auditCount }] };
        },
      },
    });

    const req = {
      user: { id: 99, username: "guarda1", role: "GUARDA" },
      body: {
        documento: "123456",
        qr_uid: "QR001",
        nombre: "Luis",
        carrera: "Ing",
        vigencia: true,
        placa: "ABC123",
        color: "Negro",
      },
    };
    const res = createRes();

    await primerIngreso(req, res, () => {});

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.estudiante.qr_uid, "QR001");
    assert.deepEqual(payloadSeen, req.body);
    assert.equal(auditCount, 2);
    assert.ok(queries.some((sql) => /BEGIN/.test(sql)), "Debe abrir transaccion");
    assert.ok(queries.some((sql) => /COMMIT/.test(sql)), "Debe confirmar transaccion");
  });

  await runTest("primerIngreso envia el actor autenticado al modelo", async () => {
    const client = {
      query: async () => ({ rows: [] }),
      release() {},
    };

    let actorSeen = null;

    const { primerIngreso } = loadController({
      poolMock: {
        connect: async () => client,
      },
      estudiantesModelMock: {
        upsertPrimerIngreso: async (_client, _payload, actorUserId) => {
          actorSeen = actorUserId;
          return {
            estudiante: {
              id: 1,
              documento: "123456",
              qr_uid: "QR001",
              nombre: "Luis",
              carrera: "Ing",
              vigencia: true,
            },
            estudianteWasCreated: true,
            motoWasCreated: true,
          };
        },
      },
      auditoriaModelMock: {
        createAuditLog: async () => ({ rows: [{ id: 1 }] }),
      },
    });

    const req = {
      user: { id: 7, username: "guarda1", role: "GUARDA" },
      body: {
        documento: "123456",
        qr_uid: "QR001",
        nombre: "Luis",
        carrera: "Ing",
        vigencia: true,
        placa: "ABC123",
        color: "Negro",
      },
    };
    const res = createRes();

    await primerIngreso(req, res, () => {});

    assert.equal(res.statusCode, 201);
    assert.equal(actorSeen, 7);
  });

  if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
  }

  console.log("All tests passed");
})();
