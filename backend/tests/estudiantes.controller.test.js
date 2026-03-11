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

function loadController({ poolMock, estudiantesModelMock }) {
  const dbPath = path.resolve(__dirname, "../config/database.js");
  const modelPath = path.resolve(__dirname, "../models/estudiantes.model.js");
  const controllerPath = path.resolve(__dirname, "../controllers/estudiantes.controller.js");

  delete require.cache[dbPath];
  delete require.cache[modelPath];
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

  await runTest("primerIngreso hace upsert incluyendo qr_uid", async () => {
    const queries = [];
    const client = {
      query: async (sql) => {
        queries.push(sql);
        return { rows: [] };
      },
      release() {},
    };

    const fakeEstudiante = {
      id: 1,
      documento: "123456",
      qr_uid: "QR001",
      nombre: "Luis",
      carrera: "Ing",
      vigencia: true,
    };

    let payloadSeen = null;

    const { primerIngreso } = loadController({
      poolMock: {
        connect: async () => client,
      },
      estudiantesModelMock: {
        upsertPrimerIngreso: async (_client, payload) => {
          payloadSeen = payload;
          return fakeEstudiante;
        },
      },
    });

    const req = {
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
    assert.ok(queries.some((sql) => /BEGIN/.test(sql)), "Debe abrir transaccion");
    assert.ok(queries.some((sql) => /COMMIT/.test(sql)), "Debe confirmar transaccion");
  });

  if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
  }

  console.log("All tests passed");
})();
