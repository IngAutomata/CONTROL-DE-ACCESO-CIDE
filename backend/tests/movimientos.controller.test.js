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

function loadControllerWithQuery(mockQueryImpl) {
  const dbPath = path.resolve(__dirname, "../config/database.js");
  const controllerPath = path.resolve(__dirname, "../controllers/movimientos.controller.js");

  delete require.cache[dbPath];
  delete require.cache[controllerPath];

  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { query: mockQueryImpl },
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

    let capturedSql = "";
    const { listarDentroCampus } = loadControllerWithQuery(async (sql) => {
      capturedSql = sql;
      return { rows: fakeRows };
    });

    const req = {};
    const res = createRes();

    await listarDentroCampus(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      count: 1,
      estudiantes: fakeRows,
    });
    assert.match(capturedSql, /WHERE\s+um\.tipo\s*=\s*'ENTRADA'/i);
    assert.match(capturedSql, /LEFT\s+JOIN\s+motocicletas/i);
  });

  await runTest("listarDentroCampus retorna lista vacia cuando no hay estudiantes dentro", async () => {
    const { listarDentroCampus } = loadControllerWithQuery(async () => ({ rows: [] }));

    const req = {};
    const res = createRes();

    await listarDentroCampus(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      count: 0,
      estudiantes: [],
    });
  });

  await runTest("listarDentroCampus retorna 500 cuando falla la consulta", async () => {
    const { listarDentroCampus } = loadControllerWithQuery(async () => {
      throw new Error("DB down");
    });

    const req = {};
    const res = createRes();
    const originalConsoleError = console.error;
    console.error = () => {};

    try {
      await listarDentroCampus(req, res);
    } finally {
      console.error = originalConsoleError;
    }

    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, {
      error: "Error consultando estudiantes dentro del campus",
    });
  });

  if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
  }

  console.log("All tests passed");
})();
