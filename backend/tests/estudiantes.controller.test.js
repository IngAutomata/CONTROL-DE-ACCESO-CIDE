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
        createPrimerIngreso: async () => {
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
        placa: "ABC12D",
        color: "Negro",
      },
    };
    const res = createRes();

    await primerIngreso(req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: "qr_uid es requerido" });
  });

  await runTest("primerIngreso rechaza placa con formato invalido", async () => {
    const { primerIngreso } = loadController({
      poolMock: {
        connect: async () => ({
          query: async () => ({ rows: [] }),
          release() {},
        }),
      },
      estudiantesModelMock: {
        createPrimerIngreso: async () => {
          throw new Error("No debe llamarse en validacion");
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

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: "placa debe tener formato ABC12D" });
  });

  await runTest("primerIngreso crea registro incluyendo qr_uid", async () => {
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
        createPrimerIngreso: async (_client, payload) => {
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
        placa: "abc12d",
        color: "Negro",
      },
    };
    const res = createRes();

    await primerIngreso(req, res, () => {});

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.estudiante.qr_uid, "QR001");
    assert.deepEqual(payloadSeen, { ...req.body, placa: "ABC12D" });
    assert.ok(queries.some((sql) => /BEGIN/.test(sql)), "Debe abrir transaccion");
    assert.ok(queries.some((sql) => /COMMIT/.test(sql)), "Debe confirmar transaccion");
  });

  await runTest("primerIngreso retorna 409 si qr_uid ya existe en otro estudiante", async () => {
    const queries = [];
    const client = {
      query: async (sql) => {
        queries.push(sql);
        return { rows: [] };
      },
      release() {},
    };

    const duplicateError = new Error("duplicate key");
    duplicateError.code = "23505";
    duplicateError.constraint = "estudiantes_qr_uid_key";

    const { primerIngreso } = loadController({
      poolMock: {
        connect: async () => client,
      },
      estudiantesModelMock: {
        createPrimerIngreso: async () => {
          throw duplicateError;
        },
      },
    });

    const req = {
      body: {
        documento: "123999",
        qr_uid: "QR001",
        nombre: "Luis",
        carrera: "Ing",
        vigencia: true,
        placa: "ABC12D",
        color: "Negro",
      },
    };
    const res = createRes();
    let nextCalled = false;

    await primerIngreso(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 409);
    assert.deepEqual(res.body, { error: "qr_uid ya esta registrado en otro estudiante" });
    assert.ok(queries.some((sql) => /BEGIN/.test(sql)), "Debe abrir transaccion");
    assert.ok(queries.some((sql) => /ROLLBACK/.test(sql)), "Debe revertir transaccion");
  });

  await runTest("primerIngreso hace rollback y delega errores inesperados", async () => {
    const queries = [];
    const client = {
      query: async (sql) => {
        queries.push(sql);
        return { rows: [] };
      },
      release() {},
    };

    const unexpectedError = new Error("fallo inesperado");

    const { primerIngreso } = loadController({
      poolMock: {
        connect: async () => client,
      },
      estudiantesModelMock: {
        createPrimerIngreso: async () => {
          throw unexpectedError;
        },
      },
    });

    const req = {
      body: {
        documento: "123999",
        qr_uid: "QR999",
        nombre: "Luis",
        carrera: "Ing",
        vigencia: true,
        placa: "ABC12D",
        color: "Negro",
      },
    };
    const res = createRes();
    let nextArg = null;

    await primerIngreso(req, res, (error) => {
      nextArg = error;
    });

    assert.equal(nextArg, unexpectedError);
    assert.equal(res.body, null);
    assert.ok(queries.some((sql) => /BEGIN/.test(sql)), "Debe abrir transaccion");
    assert.ok(queries.some((sql) => /ROLLBACK/.test(sql)), "Debe revertir transaccion");
    assert.equal(queries.some((sql) => /COMMIT/.test(sql)), false, "No debe confirmar transaccion");
  });

  if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
  }

  console.log("All tests passed");
})();
