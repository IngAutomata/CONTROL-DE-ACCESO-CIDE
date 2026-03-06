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

function loadControllerWithDb(mockQueryImpl) {
  const dbPath = path.resolve(__dirname, "../config/database.js");
  const controllerPath = path.resolve(__dirname, "../controllers/estudiantes.controller.js");

  delete require.cache[dbPath];
  delete require.cache[controllerPath];

  const client = {
    query: mockQueryImpl,
    release() {},
  };

  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: {
      query: mockQueryImpl,
      connect: async () => client,
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
    const { primerIngreso } = loadControllerWithDb(async () => {
      throw new Error("No DB call expected");
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

    await primerIngreso(req, res);

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: "Faltan datos requeridos o vigencia no es boolean" });
  });

  await runTest("primerIngreso hace upsert incluyendo qr_uid", async () => {
    const calls = [];
    const { primerIngreso } = loadControllerWithDb(async (sql, params) => {
      calls.push({ sql, params });

      if (/BEGIN/.test(sql)) return { rows: [] };
      if (/INSERT INTO estudiantes/i.test(sql)) {
        return {
          rows: [
            {
              id: 1,
              documento: "123456",
              qr_uid: "QR001",
              nombre: "Luis",
              carrera: "Ing",
              vigencia: true,
            },
          ],
        };
      }
      if (/INSERT INTO motocicletas/i.test(sql)) return { rows: [] };
      if (/COMMIT/.test(sql)) return { rows: [] };
      return { rows: [] };
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

    await primerIngreso(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.estudiante.qr_uid, "QR001");

    const upsert = calls.find((c) => /INSERT INTO estudiantes/i.test(c.sql));
    assert.ok(upsert, "Debe ejecutar upsert de estudiantes");
    assert.deepEqual(upsert.params, ["123456", "QR001", "Luis", "Ing", true]);
  });

  if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
  }

  console.log("All tests passed");
})();
