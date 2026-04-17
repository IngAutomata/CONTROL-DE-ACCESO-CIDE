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

function loadController({ poolMock, visitantesModelMock, movimientosVisitantesModelMock }) {
  const dbPath = path.resolve(__dirname, "../config/database.js");
  const visitantesModelPath = path.resolve(__dirname, "../models/visitantes.model.js");
  const movimientosVisitantesModelPath = path.resolve(__dirname, "../models/movimientos-visitantes.model.js");
  const controllerPath = path.resolve(__dirname, "../controllers/visitantes.controller.js");

  delete require.cache[dbPath];
  delete require.cache[visitantesModelPath];
  delete require.cache[movimientosVisitantesModelPath];
  delete require.cache[controllerPath];

  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: poolMock };
  require.cache[visitantesModelPath] = { id: visitantesModelPath, filename: visitantesModelPath, loaded: true, exports: visitantesModelMock };
  require.cache[movimientosVisitantesModelPath] = { id: movimientosVisitantesModelPath, filename: movimientosVisitantesModelPath, loaded: true, exports: movimientosVisitantesModelMock };

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
  await runTest("registrarMovimientoVisitante crea entrada por documento", async () => {
    const queries = [];
    const client = {
      query: async (sql) => {
        queries.push(sql);
        return { rows: [] };
      },
      release() {},
    };

    const { registrarMovimientoVisitante } = loadController({
      poolMock: { connect: async () => client },
      visitantesModelMock: {
        findByDocumentoForUpdate: async () => ({ rows: [] }),
        findByPlacaForUpdate: async () => ({ rows: [] }),
        createVisitante: async () => ({ rows: [{ id: 9, documento: "VIS10001", nombre: "Visitante Uno", celular: "3001234567", placa: "ABC12D", entidad: "Proveedor" }] }),
      },
      movimientosVisitantesModelMock: {
        createMovimientoVisitante: async () => ({ rows: [{ id: 50, visitante_id: 9, tipo: "ENTRADA", vehiculo_placa: "ABC12D", fecha_hora: "2026-04-17T08:00:00.000Z" }] }),
        getLastByVisitanteId: async () => ({ rows: [] }),
      },
    });

    const req = {
      body: {
        documento: "VIS10001",
        nombre: "Visitante Uno",
        celular: "3001234567",
        placa: "ABC12D",
        entidad: "Proveedor",
        motivo_visita: "Entrega de materiales",
        persona_visitada: "Coordinación",
      },
      user: { id: 1, role: "ADMIN" },
    };
    const res = createRes();

    await registrarMovimientoVisitante(req, res, () => {});

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.movimiento.tipo, "ENTRADA");
    assert.ok(queries.some((sql) => /BEGIN/.test(sql)));
    assert.ok(queries.some((sql) => /COMMIT/.test(sql)));
  });

  await runTest("registrarMovimientoVisitante registra salida rápida por placa", async () => {
    const client = {
      query: async () => ({ rows: [] }),
      release() {},
    };

    const { registrarMovimientoVisitante } = loadController({
      poolMock: { connect: async () => client },
      visitantesModelMock: {},
      movimientosVisitantesModelMock: {
        findCurrentInsideByPlateForUpdate: async () => ({ rows: [{ id: 12, documento: "VIS20002", nombre: "Visitante Dos", placa: "XYZ12D" }] }),
        getLastByVisitanteId: async () => ({ rows: [{ id: 80, tipo: "ENTRADA", vehiculo_placa: "XYZ12D" }] }),
        createMovimientoVisitante: async () => ({ rows: [{ id: 81, visitante_id: 12, tipo: "SALIDA", vehiculo_placa: "XYZ12D", fecha_hora: "2026-04-17T09:00:00.000Z" }] }),
      },
    });

    const req = {
      body: { placa: "XYZ12D" },
      user: { id: 1, role: "ADMIN" },
    };
    const res = createRes();

    await registrarMovimientoVisitante(req, res, () => {});

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.movimiento.tipo, "SALIDA");
    assert.equal(res.body.visitante.documento, "VIS20002");
  });

  if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
  }

  console.log("All tests passed");
})();