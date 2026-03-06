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

function loadControllerWithDb(poolMock) {
  const dbPath = path.resolve(__dirname, "../config/database.js");
  const controllerPath = path.resolve(__dirname, "../controllers/movimientos.controller.js");

  delete require.cache[dbPath];
  delete require.cache[controllerPath];

  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: poolMock,
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
    const client = {
      query: async () => ({ rows: [] }),
      release() {},
    };

    const { registrarMovimiento } = loadControllerWithDb({
      connect: async () => client,
      query: async () => ({ rows: [] }),
    });

    const req = { body: {} };
    const res = createRes();

    await registrarMovimiento(req, res);

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: "Falta qr_uid o qr_url" });
  });

  await runTest("registrarMovimiento alterna a SALIDA cuando ultimo movimiento fue ENTRADA", async () => {
    const calls = [];
    const client = {
      query: async (sql, params) => {
        calls.push({ sql, params });

        if (/BEGIN/.test(sql)) return { rows: [] };
        if (/FROM estudiantes/i.test(sql)) {
          return {
            rows: [
              {
                id: 10,
                documento: "123",
                nombre: "Luis",
                carrera: "Ing",
                vigencia: true,
              },
            ],
          };
        }
        if (/SELECT tipo FROM movimientos/i.test(sql)) {
          return { rows: [{ tipo: "ENTRADA" }] };
        }
        if (/INSERT INTO movimientos/i.test(sql)) {
          return { rows: [{ id: 77, tipo: "SALIDA", fecha: "2026-03-05T15:00:00.000Z" }] };
        }
        if (/COMMIT/.test(sql)) return { rows: [] };

        return { rows: [] };
      },
      release() {},
    };

    const { registrarMovimiento } = loadControllerWithDb({
      connect: async () => client,
      query: async () => ({ rows: [] }),
    });

    const req = {
      body: {
        qr_url: "https://cide.edu/qr/QR001?source=lector#abc",
      },
    };
    const res = createRes();

    await registrarMovimiento(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.movimiento.tipo, "SALIDA");

    const studentLookup = calls.find((c) => /FROM estudiantes/i.test(c.sql));
    assert.deepEqual(studentLookup.params, ["QR001"]);

    const insertMov = calls.find((c) => /INSERT INTO movimientos/i.test(c.sql));
    assert.deepEqual(insertMov.params, [10, "SALIDA"]);
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

    let capturedSql = "";
    const { listarDentroCampus } = loadControllerWithDb({
      query: async (sql) => {
        capturedSql = sql;
        return { rows: fakeRows };
      },
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
    const { listarDentroCampus } = loadControllerWithDb({ query: async () => ({ rows: [] }) });

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
    const { listarDentroCampus } = loadControllerWithDb({
      query: async () => {
        throw new Error("DB down");
      },
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
