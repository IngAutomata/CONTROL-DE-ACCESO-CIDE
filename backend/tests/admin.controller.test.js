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

function loadController({ usuariosModelMock, bcryptMock, estudiantesModelMock, movimientosModelMock, poolMock }) {
  const usuariosModelPath = path.resolve(__dirname, "../models/usuarios.model.js");
  const estudiantesModelPath = path.resolve(__dirname, "../models/estudiantes.model.js");
  const movimientosModelPath = path.resolve(__dirname, "../models/movimientos.model.js");
  const poolPath = path.resolve(__dirname, "../config/database.js");
  const bcryptPath = path.resolve(__dirname, "../node_modules/bcrypt/bcrypt.js");
  const controllerPath = path.resolve(__dirname, "../controllers/admin.controller.js");

  delete require.cache[usuariosModelPath];
  delete require.cache[estudiantesModelPath];
  delete require.cache[movimientosModelPath];
  delete require.cache[poolPath];
  delete require.cache[bcryptPath];
  delete require.cache[controllerPath];

  require.cache[usuariosModelPath] = {
    id: usuariosModelPath,
    filename: usuariosModelPath,
    loaded: true,
    exports: usuariosModelMock,
  };

  require.cache[estudiantesModelPath] = {
    id: estudiantesModelPath,
    filename: estudiantesModelPath,
    loaded: true,
    exports: estudiantesModelMock || {},
  };

  require.cache[movimientosModelPath] = {
    id: movimientosModelPath,
    filename: movimientosModelPath,
    loaded: true,
    exports: movimientosModelMock || {},
  };

  require.cache[poolPath] = {
    id: poolPath,
    filename: poolPath,
    loaded: true,
    exports: poolMock || {},
  };

  require.cache[bcryptPath] = {
    id: bcryptPath,
    filename: bcryptPath,
    loaded: true,
    exports: bcryptMock,
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

  await runTest("listarUsuarios retorna count y usuarios", async () => {
    const fakeRows = [{ id: 1, username: "admin", role: "ADMIN" }];
    const { listarUsuarios } = loadController({
      usuariosModelMock: {
        listUsuarios: async () => ({ rows: fakeRows }),
      },
      bcryptMock: {},
      estudiantesModelMock: {},
      poolMock: {},
    });

    const res = createRes();
    await listarUsuarios({}, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      count: 1,
      usuarios: fakeRows,
    });
  });

  await runTest("crearUsuario retorna 409 si username ya existe", async () => {
    const { crearUsuario } = loadController({
      usuariosModelMock: {
        findByUsernameAnyStatus: async () => ({ rows: [{ id: 1, username: "admin" }] }),
      },
      bcryptMock: {
        hash: async () => "hash",
      },
      estudiantesModelMock: {},
      poolMock: {},
    });

    const req = { body: { username: "admin", password: "Admin123!", role: "ADMIN" } };
    const res = createRes();
    await crearUsuario(req, res, () => {});

    assert.equal(res.statusCode, 409);
    assert.deepEqual(res.body, { error: "El usuario ya existe" });
  });

  await runTest("crearUsuario crea usuario con role normalizado", async () => {
    let payload = null;
    const { crearUsuario } = loadController({
      usuariosModelMock: {
        findByUsernameAnyStatus: async () => ({ rows: [] }),
        createUsuario: async (input) => {
          payload = input;
          return { rows: [{ id: 8, username: input.username, role: input.role }] };
        },
      },
      bcryptMock: {
        hash: async () => "hash-123",
      },
      estudiantesModelMock: {},
      poolMock: {},
    });

    const req = { body: { username: "guardia1", password: "Segura123!", role: "staff" } };
    const res = createRes();
    await crearUsuario(req, res, () => {});

    assert.equal(res.statusCode, 201);
    assert.equal(payload.role, "GUARDA");
    assert.equal(payload.passwordHash, "hash-123");
    assert.equal(res.body.usuario.role, "GUARDA");
  });

  await runTest("obtenerUsuarioPorUsername retorna usuario encontrado", async () => {
    const { obtenerUsuarioPorUsername } = loadController({
      usuariosModelMock: {
        findByUsername: async () => ({ rows: [{ id: 3, username: "consulta", role: "CONSULTA" }] }),
      },
      bcryptMock: {},
      estudiantesModelMock: {},
      poolMock: {},
    });

    const req = { params: { username: "consulta" } };
    const res = createRes();

    await obtenerUsuarioPorUsername(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.username, "consulta");
  });

  await runTest("actualizarUsuario modifica role y password", async () => {
    let payload = null;
    const { actualizarUsuario } = loadController({
      usuariosModelMock: {
        findById: async () => ({ rows: [{ id: 7, username: "guardia1", role: "GUARDA" }] }),
        findByUsername: async () => ({ rows: [] }),
        updateUsuario: async (_id, input) => {
          payload = input;
          return { rows: [{ id: 7, username: "guardia1", role: "CONSULTA" }] };
        },
      },
      bcryptMock: {
        hash: async () => "hash-new",
      },
      estudiantesModelMock: {},
      poolMock: {},
    });

    const req = {
      params: { id: "7" },
      body: { role: "consulta", password: "Nueva123!" },
    };
    const res = createRes();

    await actualizarUsuario(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(payload.role, "CONSULTA");
    assert.equal(payload.passwordHash, "hash-new");
    assert.equal(res.body.usuario.role, "CONSULTA");
  });

  await runTest("actualizarUsuarioPorUsername usa username como llave de busqueda", async () => {
    let updateId = null;
    const { actualizarUsuarioPorUsername } = loadController({
      usuariosModelMock: {
        findByUsername: async (username) => {
          if (username === "guardia1") return { rows: [{ id: 7, username: "guardia1", role: "GUARDA" }] };
          return { rows: [] };
        },
        findById: async () => ({ rows: [{ id: 7, username: "guardia1", role: "GUARDA" }] }),
        updateUsuario: async (id, input) => {
          updateId = id;
          return { rows: [{ id, username: input.username || "guardia1", role: input.role || "GUARDA" }] };
        },
      },
      bcryptMock: {
        hash: async () => "hash-new",
      },
      estudiantesModelMock: {},
      poolMock: {},
    });

    const req = {
      params: { username: "guardia1" },
      body: { role: "consulta" },
    };
    const res = createRes();

    await actualizarUsuarioPorUsername(req, res, () => {});

    assert.equal(updateId, 7);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.usuario.role, "CONSULTA");
  });

  await runTest("eliminarUsuario retorna 404 si no existe", async () => {
    const { eliminarUsuario } = loadController({
      usuariosModelMock: {
        findById: async () => ({ rows: [] }),
        deactivateUsuario: async () => ({ rows: [] }),
      },
      bcryptMock: {},
      estudiantesModelMock: {},
      movimientosModelMock: {},
      poolMock: {},
    });

    const req = { user: { id: 1, username: "admin", role: "ADMIN" }, params: { id: "99" } };
    const res = createRes();

    await eliminarUsuario(req, res, () => {});

    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.body, { error: "Usuario no encontrado" });
  });

  await runTest("eliminarUsuarioPorUsername elimina cuando existe", async () => {
    let deletedId = null;
    const { eliminarUsuarioPorUsername } = loadController({
      usuariosModelMock: {
        findByUsername: async () => ({ rows: [{ id: 9, username: "consulta", role: "CONSULTA" }] }),
        findById: async (id) => ({ rows: [{ id, username: "consulta", role: "CONSULTA", is_active: true }] }),
        deactivateUsuario: async (id) => {
          deletedId = id;
          return { rows: [{ id, username: "consulta", role: "CONSULTA", is_active: false }] };
        },
      },
      bcryptMock: {},
      estudiantesModelMock: {},
      poolMock: {},
    });

    const req = { user: { id: 1, username: "admin", role: "ADMIN" }, params: { username: "consulta" } };
    const res = createRes();

    await eliminarUsuarioPorUsername(req, res, () => {});

    assert.equal(deletedId, 9);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.usuario.username, "consulta");
    assert.equal(res.body.message, "Usuario desactivado");
  });

  await runTest("reactivarUsuario vuelve activo un usuario desactivado", async () => {
    const { reactivarUsuario } = loadController({
      usuariosModelMock: {
        reactivateUsuario: async (id) => ({
          rows: [{ id, username: "consulta", role: "CONSULTA", is_active: true }],
        }),
      },
      bcryptMock: {},
      estudiantesModelMock: {},
      poolMock: {},
    });

    const req = { params: { id: "9" } };
    const res = createRes();

    await reactivarUsuario(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.message, "Usuario reactivado");
    assert.equal(res.body.usuario.is_active, true);
  });

  await runTest("eliminarUsuario protege al admin principal", async () => {
    const { eliminarUsuario } = loadController({
      usuariosModelMock: {
        findById: async () => ({ rows: [{ id: 1, username: "admin", role: "ADMIN", is_active: true }] }),
      },
      bcryptMock: {},
      estudiantesModelMock: {},
      movimientosModelMock: {},
      poolMock: {},
    });

    const req = { user: { id: 2, username: "root2", role: "ADMIN" }, params: { id: "1" } };
    const res = createRes();

    await eliminarUsuario(req, res, () => {});

    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, { error: "El admin principal no puede desactivarse" });
  });

  await runTest("eliminarUsuario impide auto-desactivación", async () => {
    const { eliminarUsuario } = loadController({
      usuariosModelMock: {
        findById: async () => ({ rows: [{ id: 5, username: "admin2", role: "ADMIN", is_active: true }] }),
      },
      bcryptMock: {},
      estudiantesModelMock: {},
      movimientosModelMock: {},
      poolMock: {},
    });

    const req = { user: { id: 5, username: "admin2", role: "ADMIN" }, params: { id: "5" } };
    const res = createRes();

    await eliminarUsuario(req, res, () => {});

    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, { error: "No puedes desactivar tu propio usuario mientras la sesión está activa" });
  });

  await runTest("obtenerEstudiantePorPlaca retorna estudiante encontrado", async () => {
    const { obtenerEstudiantePorPlaca } = loadController({
      usuariosModelMock: {},
      bcryptMock: {},
      estudiantesModelMock: {
        findByPlaca: async () => ({
          rows: [{ estudiante_id: 5, documento: "123456", placa: "ABC12D", nombre: "Luis", vigencia: true }],
        }),
      },
      poolMock: {},
    });

    const req = { params: { placa: "abc12d" } };
    const res = createRes();

    await obtenerEstudiantePorPlaca(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.placa, "ABC12D");
  });

  await runTest("actualizarEstudiante retorna 409 si qr_uid ya existe", async () => {
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

    const { actualizarEstudiante } = loadController({
      usuariosModelMock: {},
      bcryptMock: {},
      estudiantesModelMock: {
        findById: async () => ({
          rows: [{ estudiante_id: 3, documento: "12345678", qr_uid: VALID_QR, nombre: "Luis", carrera: "Ing", celular: "3001234567", vigencia: true, placa: "ABC12D", color: "Negro" }],
        }),
        updateById: async () => {
          throw duplicateError;
        },
      },
      poolMock: {
        connect: async () => client,
      },
    });

    const req = {
      params: { id: "3" },
      body: {
        documento: "12345678",
        qr_uid: VALID_QR,
        nombre: "Luis",
        carrera: "Ing",
        celular: "3001234567",
        vigencia: true,
        placa: "ABC12D",
        color: "Negro",
      },
    };
    const res = createRes();

    await actualizarEstudiante(req, res, () => {});

    assert.equal(res.statusCode, 409);
    assert.deepEqual(res.body, { error: "qr_uid ya esta registrado en otro estudiante" });
    assert.ok(queries.some((sql) => /BEGIN/.test(sql)), "Debe abrir transaccion");
    assert.ok(queries.some((sql) => /ROLLBACK/.test(sql)), "Debe revertir transaccion");
  });

  await runTest("actualizarEstudiante rechaza documento invalido", async () => {
    const { actualizarEstudiante } = loadController({
      usuariosModelMock: {},
      bcryptMock: {},
      estudiantesModelMock: {
        findById: async () => ({
          rows: [{ estudiante_id: 3, documento: "12345678", qr_uid: VALID_QR, nombre: "Luis", carrera: "Ing", celular: "3001234567", vigencia: true, placa: "ABC12D", color: "Negro" }],
        }),
        updateById: async () => {
          throw new Error("No debe llamarse en validacion");
        },
      },
      poolMock: {
        connect: async () => ({
          query: async () => ({ rows: [] }),
          release() {},
        }),
      },
    });

    const req = {
      params: { id: "3" },
      body: {
        documento: "12A4567",
        qr_uid: VALID_QR,
        nombre: "Luis",
        carrera: "Ing",
        celular: "3001234567",
        vigencia: true,
        placa: "ABC12D",
        color: "Negro",
      },
    };
    const res = createRes();

    await actualizarEstudiante(req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: "documento debe tener entre 8 y 10 digitos numericos" });
  });

  await runTest("actualizarEstudiante rechaza qr_uid fuera de estructura CIDE", async () => {
    const { actualizarEstudiante } = loadController({
      usuariosModelMock: {},
      bcryptMock: {},
      estudiantesModelMock: {
        findById: async () => ({
          rows: [{ estudiante_id: 3, documento: "12345678", qr_uid: VALID_QR, nombre: "Luis", carrera: "Ing", celular: "3001234567", vigencia: true, placa: "ABC12D", color: "Negro" }],
        }),
        updateById: async () => {
          throw new Error("No debe llamarse en validacion");
        },
      },
      poolMock: {
        connect: async () => ({
          query: async () => ({ rows: [] }),
          release() {},
        }),
      },
    });

    const req = {
      params: { id: "3" },
      body: {
        documento: "12345678",
        qr_uid: "QR001",
        nombre: "Luis",
        carrera: "Ing",
        celular: "3001234567",
        vigencia: true,
        placa: "ABC12D",
        color: "Negro",
      },
    };
    const res = createRes();

    await actualizarEstudiante(req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: "qr_uid debe tener formato QR de CIDE" });
  });

  await runTest("actualizarEstudiante rechaza celular invalido", async () => {
    const { actualizarEstudiante } = loadController({
      usuariosModelMock: {},
      bcryptMock: {},
      estudiantesModelMock: {
        findById: async () => ({
          rows: [{ estudiante_id: 3, documento: "12345678", qr_uid: VALID_QR, nombre: "Luis", carrera: "Ing", celular: "3001234567", vigencia: true, placa: "ABC12D", color: "Negro" }],
        }),
        updateById: async () => {
          throw new Error("No debe llamarse en validacion");
        },
      },
      poolMock: {
        connect: async () => ({
          query: async () => ({ rows: [] }),
          release() {},
        }),
      },
    });

    const req = {
      params: { id: "3" },
      body: {
        documento: "12345678",
        qr_uid: VALID_QR,
        nombre: "Luis",
        carrera: "Ing",
        celular: "300-123-4567",
        vigencia: true,
        placa: "ABC12D",
        color: "Negro",
      },
    };
    const res = createRes();

    await actualizarEstudiante(req, res, () => {});

    assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: "celular debe tener exactamente 10 numeros" });
  });

  await runTest("actualizarEstudiante retorna 409 si celular ya existe en otro estudiante", async () => {
    const queries = [];
    const client = {
      query: async (sql) => {
        queries.push(sql);
        return { rows: [] };
      },
      release() {},
    };

    const { actualizarEstudiante } = loadController({
      usuariosModelMock: {},
      bcryptMock: {},
      estudiantesModelMock: {
        findById: async () => ({
          rows: [{ estudiante_id: 3, documento: "12345678", qr_uid: VALID_QR, nombre: "Luis", carrera: "Ing", celular: "3001234567", vigencia: true, placa: "ABC12D", color: "Negro" }],
        }),
        findByDocumentoForUpdate: async () => ({ rows: [] }),
        findByQrCandidatesForUpdate: async () => ({ rows: [] }),
        findByPlacaForUpdate: async () => ({ rows: [] }),
        findByCelularForUpdate: async () => ({
          rows: [{ id: 11, documento: "87654321", qr_uid: "https://soe.cide.edu.co/verificar-estudiante/QA11" }],
        }),
        updateById: async () => {
          throw new Error("No debe actualizar cuando el celular ya existe");
        },
      },
      poolMock: {
        connect: async () => client,
      },
    });

    const req = {
      params: { id: "3" },
      body: {
        documento: "12345678",
        qr_uid: VALID_QR,
        nombre: "Luis",
        carrera: "Ing",
        celular: "3001234567",
        vigencia: true,
        placa: "ABC12D",
        color: "Negro",
      },
    };
    const res = createRes();

    await actualizarEstudiante(req, res, () => {});

    assert.equal(res.statusCode, 409);
    assert.deepEqual(res.body, { error: "celular ya esta registrado en otro estudiante" });
    assert.ok(queries.some((sql) => /BEGIN/.test(sql)), "Debe abrir transaccion");
    assert.ok(queries.some((sql) => /ROLLBACK/.test(sql)), "Debe revertir transaccion");
  });

  await runTest("actualizarEstudiantePorDocumento usa documento como llave de busqueda", async () => {
    const queries = [];
    const client = {
      query: async (sql) => {
        queries.push(sql);
        return { rows: [] };
      },
      release() {},
    };
    let auditSeen = null;

    const { actualizarEstudiantePorDocumento } = loadController({
      usuariosModelMock: {},
      bcryptMock: {},
      estudiantesModelMock: {
        findByDocumento: async () => ({
          rows: [{ estudiante_id: 11, documento: "12345678", qr_uid: VALID_QR, nombre: "Luis", carrera: "Ing", celular: "3001234567", vigencia: true, placa: "ABC12D", color: "Negro" }],
        }),
        findById: async () => ({
          rows: [{ estudiante_id: 11, documento: "12345678", qr_uid: VALID_QR, nombre: "Luis", carrera: "Ing", celular: "3001234567", vigencia: true, placa: "ABC12D", color: "Negro" }],
        }),
        updateById: async (_client, id, _payload, audit) => {
          auditSeen = audit;
          return {
          rows: [{ id, documento: "12345678", qr_uid: VALID_QR, nombre: "Luis", carrera: "Ing", celular: "3001234567", vigencia: true }],
          };
        },
      },
      poolMock: {
        connect: async () => client,
      },
    });

    const req = {
      user: { id: 55, username: "guarda", role: "GUARDA" },
      params: { documento: "12345678" },
      body: {
        documento: "12345678",
        qr_uid: VALID_QR,
        nombre: "Luis",
        carrera: "Ing",
        celular: "3001234567",
        vigencia: true,
        placa: "ABC12D",
        color: "Negro",
      },
    };
    const res = createRes();

    await actualizarEstudiantePorDocumento(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.estudiante.id, 11);
    assert.deepEqual(auditSeen, { actorUserId: 55 });
    assert.ok(queries.some((sql) => /COMMIT/.test(sql)), "Debe confirmar transaccion");
  });

  await runTest("actualizarEstudiantePorDocumento rechaza cambios de identidad para GUARDA", async () => {
    const queries = [];
    const client = {
      query: async (sql) => {
        queries.push(sql);
        return { rows: [] };
      },
      release() {},
    };

    const { actualizarEstudiantePorDocumento } = loadController({
      usuariosModelMock: {},
      bcryptMock: {},
      estudiantesModelMock: {
        findByDocumento: async () => ({
          rows: [{ estudiante_id: 11, documento: "12345678", qr_uid: VALID_QR, nombre: "Luis", carrera: "Ing", celular: "3001234567", vigencia: true, placa: "ABC12D", color: "Negro" }],
        }),
        findById: async () => ({
          rows: [{ estudiante_id: 11, documento: "12345678", qr_uid: VALID_QR, nombre: "Luis", carrera: "Ing", celular: "3001234567", vigencia: true, placa: "ABC12D", color: "Negro" }],
        }),
        updateById: async () => {
          throw new Error("No debe actualizar cuando GUARDA cambia identidad");
        },
      },
      poolMock: {
        connect: async () => client,
      },
    });

    const req = {
      user: { id: 55, username: "guarda", role: "GUARDA" },
      params: { documento: "12345678" },
      body: {
        documento: "87654321",
        qr_uid: VALID_QR,
        nombre: "Otro Nombre",
        carrera: "Otra Carrera",
        celular: "3001234567",
        vigencia: true,
        placa: "ABC12D",
        color: "Negro",
      },
    };
    const res = createRes();

    await actualizarEstudiantePorDocumento(req, res, () => {});

    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, { error: "GUARDA solo puede actualizar placa, color, celular y vigencia" });
    assert.ok(queries.some((sql) => /ROLLBACK/.test(sql)), "Debe revertir transaccion");
  });

  await runTest("eliminarEstudiante desactiva cuando existe", async () => {
    const queries = [];
    const client = {
      query: async (sql) => {
        queries.push(sql);
        return { rows: [] };
      },
      release() {},
    };

    const { eliminarEstudiante } = loadController({
      usuariosModelMock: {},
      bcryptMock: {},
      estudiantesModelMock: {
        findById: async () => ({
          rows: [{ estudiante_id: 5, documento: "123456", nombre: "Luis", placa: "ABC12D", vigencia: true }],
        }),
        softDeleteById: async () => ({
          rows: [{ id: 5, documento: "123456", qr_uid: "QR001", nombre: "Luis", carrera: "Ing", vigencia: false, is_deleted: true }],
        }),
      },
      movimientosModelMock: {
        getLastByEstudianteId: async () => ({ rows: [{ tipo: "SALIDA" }] }),
      },
      poolMock: {
        connect: async () => client,
      },
    });

    const req = { params: { id: "5" } };
    const res = createRes();

    await eliminarEstudiante(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.message, "Estudiante desactivado");
    assert.ok(queries.some((sql) => /BEGIN/.test(sql)), "Debe abrir transaccion");
    assert.ok(queries.some((sql) => /COMMIT/.test(sql)), "Debe confirmar transaccion");
  });

  await runTest("eliminarEstudiantePorDocumento desactiva cuando existe", async () => {
    const queries = [];
    const client = {
      query: async (sql) => {
        queries.push(sql);
        return { rows: [] };
      },
      release() {},
    };

    const { eliminarEstudiantePorDocumento } = loadController({
      usuariosModelMock: {},
      bcryptMock: {},
      estudiantesModelMock: {
        findByDocumento: async () => ({
          rows: [{ estudiante_id: 5, documento: "123456", qr_uid: "QR001", nombre: "Luis", carrera: "Ing", vigencia: true }],
        }),
        findById: async () => ({
          rows: [{ estudiante_id: 5, documento: "123456", nombre: "Luis", placa: "ABC12D", vigencia: true }],
        }),
        softDeleteById: async () => ({
          rows: [{ id: 5, documento: "123456", qr_uid: "QR001", nombre: "Luis", carrera: "Ing", vigencia: false, is_deleted: true }],
        }),
      },
      movimientosModelMock: {
        getLastByEstudianteId: async () => ({ rows: [{ tipo: "SALIDA" }] }),
      },
      poolMock: {
        connect: async () => client,
      },
    });

    const req = { params: { documento: "123456" } };
    const res = createRes();

    await eliminarEstudiantePorDocumento(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.estudiante.documento, "123456");
    assert.ok(queries.some((sql) => /COMMIT/.test(sql)), "Debe confirmar transaccion");
  });

  await runTest("reactivarEstudiante vuelve activo un estudiante desactivado", async () => {
    const queries = [];
    const client = {
      query: async (sql) => {
        queries.push(sql);
        return { rows: [] };
      },
      release() {},
    };

    const { reactivarEstudiante } = loadController({
      usuariosModelMock: {},
      bcryptMock: {},
      estudiantesModelMock: {
        restoreById: async () => ({
          rows: [{ id: 5, documento: "123456", nombre: "Luis", is_deleted: false }],
        }),
      },
      poolMock: {
        connect: async () => client,
      },
    });

    const req = { params: { id: "5" } };
    const res = createRes();

    await reactivarEstudiante(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.message, "Estudiante reactivado");
    assert.ok(queries.some((sql) => /COMMIT/.test(sql)), "Debe confirmar transaccion");
  });

  await runTest("eliminarEstudiante rechaza desactivar si sigue dentro del campus", async () => {
    const queries = [];
    const client = {
      query: async (sql) => {
        queries.push(sql);
        return { rows: [] };
      },
      release() {},
    };

    const { eliminarEstudiante } = loadController({
      usuariosModelMock: {},
      bcryptMock: {},
      estudiantesModelMock: {
        findById: async () => ({
          rows: [{ estudiante_id: 5, documento: "123456", nombre: "Luis", placa: "ABC12D", vigencia: true }],
        }),
      },
      movimientosModelMock: {
        getLastByEstudianteId: async () => ({ rows: [{ tipo: "ENTRADA" }] }),
      },
      poolMock: {
        connect: async () => client,
      },
    });

    const req = { params: { id: "5" } };
    const res = createRes();

    await eliminarEstudiante(req, res, () => {});

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.code, "STUDENT_INSIDE_CAMPUS");
    assert.ok(queries.some((sql) => /ROLLBACK/.test(sql)), "Debe revertir transaccion");
  });

  await runTest("registrarSalidaEstudianteAdmin registra salida y deja listo para desactivar", async () => {
    const queries = [];
    const client = {
      query: async (sql) => {
        queries.push(sql);
        return { rows: [] };
      },
      release() {},
    };
    let actorAudit = null;

    const { registrarSalidaEstudianteAdmin } = loadController({
      usuariosModelMock: {},
      bcryptMock: {},
      estudiantesModelMock: {
        findByDocumento: async () => ({
          rows: [{ estudiante_id: 5, documento: "123456", nombre: "Luis", placa: "ABC12D", vigencia: true }],
        }),
      },
      movimientosModelMock: {
        getLastByEstudianteId: async () => ({ rows: [{ tipo: "ENTRADA" }] }),
        createMovimiento: async (_client, estudianteId, tipo, audit) => {
          actorAudit = { estudianteId, tipo, audit };
          return { rows: [{ id: 99, tipo }] };
        },
      },
      poolMock: {
        connect: async () => client,
      },
    });

    const req = {
      user: { id: 7, username: "admin", role: "ADMIN" },
      params: { documento: "123456" },
    };
    const res = createRes();

    await registrarSalidaEstudianteAdmin(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.message, "Salida registrada correctamente. Ya puedes desactivar al estudiante.");
    assert.deepEqual(actorAudit, { estudianteId: 5, tipo: "SALIDA", audit: { actorUserId: 7 } });
    assert.ok(queries.some((sql) => /COMMIT/.test(sql)), "Debe confirmar transaccion");
  });

  if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
  }

  console.log("All tests passed");
})();
