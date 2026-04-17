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

function loadController({ poolMock, estudiantesModelMock, solicitudesModelMock, solicitudMailerMock = null, solicitudUploadsMock = null }) {
  const dbPath = path.resolve(__dirname, "../config/database.js");
  const estudiantesModelPath = path.resolve(__dirname, "../models/estudiantes.model.js");
  const solicitudesModelPath = path.resolve(__dirname, "../models/solicitudes-inscripcion.model.js");
  const solicitudMailerPath = path.resolve(__dirname, "../utils/solicitud-mailer.js");
  const solicitudUploadsPath = path.resolve(__dirname, "../utils/solicitud-uploads.js");
  const controllerPath = path.resolve(__dirname, "../controllers/solicitudes-inscripcion.controller.js");

  delete require.cache[dbPath];
  delete require.cache[estudiantesModelPath];
  delete require.cache[solicitudesModelPath];
  delete require.cache[solicitudMailerPath];
  delete require.cache[solicitudUploadsPath];
  delete require.cache[controllerPath];

  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: poolMock };
  require.cache[estudiantesModelPath] = { id: estudiantesModelPath, filename: estudiantesModelPath, loaded: true, exports: estudiantesModelMock };
  require.cache[solicitudesModelPath] = { id: solicitudesModelPath, filename: solicitudesModelPath, loaded: true, exports: solicitudesModelMock };
  require.cache[solicitudMailerPath] = {
    id: solicitudMailerPath,
    filename: solicitudMailerPath,
    loaded: true,
    exports: solicitudMailerMock || {
      notifySolicitudAprobada: async () => {},
      notifySolicitudCreada: async () => {},
      notifySolicitudExpirada: async () => {},
      notifySolicitudRechazada: async () => {},
    },
  };
  require.cache[solicitudUploadsPath] = {
    id: solicitudUploadsPath,
    filename: solicitudUploadsPath,
    loaded: true,
    exports: solicitudUploadsMock || {
      removeStoredFiles: async () => {},
      storeAttachment: async () => ({ absolutePath: "fake-path", publicUrl: "/uploads/fake" }),
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
  const VALID_BODY = {
    documento: "12345678",
    qr_uid: "https://soe.cide.edu.co/verificar-estudiante/NjEyMzE2",
    nombre: "Luis Ramón",
    carrera: "Ingeniería",
    correo_institucional: "luis@cide.edu.co",
    celular: "3001234567",
    placa: "ABC12D",
    color: "Negro",
    placa_secundaria: "DEF34G",
    color_secundaria: "Blanco",
    qr_imagen_url: "uploads/qr-luis.jpg",
    tarjeta_propiedad_principal_url: "uploads/tarjeta-principal.jpg",
    tarjeta_propiedad_secundaria_url: "uploads/tarjeta-secundaria.jpg",
    autoriza_tratamiento_datos: true,
  };

  await runTest("crearSolicitudInscripcion exige correo institucional @cide.edu.co", async () => {
    const { crearSolicitudInscripcion } = loadController({
      poolMock: {},
      estudiantesModelMock: {},
      solicitudesModelMock: {},
    });

    const req = { body: { ...VALID_BODY, correo_institucional: "luis@gmail.com" } };
    const res = createRes();

    await crearSolicitudInscripcion(req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: "correo_institucional debe pertenecer al dominio @cide.edu.co" });
  });

  await runTest("crearSolicitudInscripcion exige autorización de tratamiento de datos", async () => {
    const { crearSolicitudInscripcion } = loadController({
      poolMock: {},
      estudiantesModelMock: {},
      solicitudesModelMock: {},
    });

    const req = { body: { ...VALID_BODY, autoriza_tratamiento_datos: false } };
    const res = createRes();

    await crearSolicitudInscripcion(req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: "Debes autorizar el tratamiento de datos antes de enviar la solicitud" });
  });

  await runTest("crearSolicitudInscripcion registra solicitud pendiente válida y envía correo", async () => {
    const queries = [];
    const notifications = [];
    const client = {
      query: async (sql) => {
        queries.push(sql);
        return { rows: [] };
      },
      release() {},
    };

    const { crearSolicitudInscripcion } = loadController({
      poolMock: {
        connect: async () => client,
      },
      estudiantesModelMock: {
        findByDocumentoForUpdate: async () => ({ rows: [] }),
        findByQrCandidatesForUpdate: async () => ({ rows: [] }),
        findByPlacaForUpdate: async () => ({ rows: [] }),
        findByCelularForUpdate: async () => ({ rows: [] }),
      },
      solicitudesModelMock: {
        expirePending: async () => ({ rows: [] }),
        findPendingConflict: async () => ({ rows: [] }),
        createSolicitud: async () => ({ rows: [{ id: 91 }] }),
        findById: async () => ({ rows: [{ id: 91, estado: "PENDIENTE", documento: VALID_BODY.documento, correo_institucional: VALID_BODY.correo_institucional, nombre: VALID_BODY.nombre }] }),
      },
      solicitudMailerMock: {
        notifySolicitudAprobada: async () => {},
        notifySolicitudCreada: async (solicitud) => { notifications.push(["creada", solicitud.id]); },
        notifySolicitudExpirada: async () => {},
        notifySolicitudRechazada: async () => {},
      },
    });

    const req = { body: VALID_BODY };
    const res = createRes();

    await crearSolicitudInscripcion(req, res, () => {});

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.solicitud.estado, "PENDIENTE");
    assert.ok(queries.some((sql) => /BEGIN/.test(sql)));
    assert.ok(queries.some((sql) => /COMMIT/.test(sql)));
    assert.deepEqual(notifications, [["creada", 91]]);
  });

  await runTest("aprobarSolicitudInscripcion crea estudiante, aprueba y envía correo", async () => {
    const queries = [];
    const notifications = [];
    const client = {
      query: async (sql) => {
        queries.push(sql);
        return { rows: [] };
      },
      release() {},
    };

    const pending = {
      id: 7,
      estado: "PENDIENTE",
      expires_at: "2099-01-01T00:00:00.000Z",
      documento: VALID_BODY.documento,
      qr_uid: VALID_BODY.qr_uid,
      nombre: VALID_BODY.nombre,
      carrera: VALID_BODY.carrera,
      celular: VALID_BODY.celular,
      placa: VALID_BODY.placa,
      color: VALID_BODY.color,
      placa_secundaria: VALID_BODY.placa_secundaria,
      color_secundaria: VALID_BODY.color_secundaria,
      correo_institucional: VALID_BODY.correo_institucional,
      notas_revision: "Validado",
    };

    const { aprobarSolicitudInscripcion } = loadController({
      poolMock: {
        connect: async () => client,
      },
      estudiantesModelMock: {
        findByDocumentoForUpdate: async () => ({ rows: [] }),
        findByQrCandidatesForUpdate: async () => ({ rows: [] }),
        findByPlacaForUpdate: async () => ({ rows: [] }),
        findByCelularForUpdate: async () => ({ rows: [] }),
        createPrimerIngreso: async () => ({ estudiante_id: 15, documento: VALID_BODY.documento }),
      },
      solicitudesModelMock: {
        SOLICITUD_ESTADOS: {
          PENDIENTE: "PENDIENTE",
          APROBADA: "APROBADA",
          RECHAZADA: "RECHAZADA",
          EXPIRADA: "EXPIRADA",
        },
        expirePending: async () => ({ rows: [] }),
        findById: async (_db, id) => ({ rows: [{ ...pending, id, reviewed_by_username: "admin" }] }),
        markApproved: async () => ({ rows: [{ id: 7 }] }),
      },
      solicitudMailerMock: {
        notifySolicitudAprobada: async (solicitud) => { notifications.push(["aprobada", solicitud.id]); },
        notifySolicitudCreada: async () => {},
        notifySolicitudExpirada: async () => {},
        notifySolicitudRechazada: async () => {},
      },
    });

    const req = {
      params: { id: "7" },
      body: { notas_revision: "Validado" },
      user: { id: 1, username: "admin", role: "ADMIN" },
    };
    const res = createRes();

    await aprobarSolicitudInscripcion(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.message, "Solicitud aprobada y estudiante creado");
    assert.ok(queries.some((sql) => /BEGIN/.test(sql)));
    assert.ok(queries.some((sql) => /COMMIT/.test(sql)));
    assert.deepEqual(notifications, [["aprobada", 7]]);
  });

  await runTest("rechazarSolicitudInscripcion exige motivo", async () => {
    const { rechazarSolicitudInscripcion } = loadController({
      poolMock: {},
      estudiantesModelMock: {},
      solicitudesModelMock: {},
    });

    const req = {
      params: { id: "5" },
      body: {},
      user: { id: 1, username: "admin", role: "ADMIN" },
    };
    const res = createRes();

    await rechazarSolicitudInscripcion(req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: "motivo_rechazo es requerido" });
  });

  await runTest("rechazarSolicitudInscripcion rechaza y envía correo", async () => {
    const notifications = [];
    const client = {
      query: async () => ({ rows: [] }),
      release() {},
    };

    const pending = {
      id: 8,
      estado: "PENDIENTE",
      expires_at: "2099-01-01T00:00:00.000Z",
      documento: VALID_BODY.documento,
      qr_uid: VALID_BODY.qr_uid,
      nombre: VALID_BODY.nombre,
      carrera: VALID_BODY.carrera,
      celular: VALID_BODY.celular,
      placa: VALID_BODY.placa,
      color: VALID_BODY.color,
      correo_institucional: VALID_BODY.correo_institucional,
      motivo_rechazo: "Documento ilegible",
      notas_revision: "Sube otra imagen",
    };

    const { rechazarSolicitudInscripcion } = loadController({
      poolMock: {
        connect: async () => client,
      },
      estudiantesModelMock: {},
      solicitudesModelMock: {
        SOLICITUD_ESTADOS: {
          PENDIENTE: "PENDIENTE",
          APROBADA: "APROBADA",
          RECHAZADA: "RECHAZADA",
          EXPIRADA: "EXPIRADA",
        },
        expirePending: async () => ({ rows: [] }),
        findById: async (_db, id) => ({ rows: [{ ...pending, id }] }),
        markRejected: async () => ({ rows: [{ id: 8 }] }),
      },
      solicitudMailerMock: {
        notifySolicitudAprobada: async () => {},
        notifySolicitudCreada: async () => {},
        notifySolicitudExpirada: async () => {},
        notifySolicitudRechazada: async (solicitud) => { notifications.push(["rechazada", solicitud.id]); },
      },
    });

    const req = {
      params: { id: "8" },
      body: { motivo_rechazo: "Documento ilegible", notas_revision: "Sube otra imagen" },
      user: { id: 1, username: "admin", role: "ADMIN" },
    };
    const res = createRes();

    await rechazarSolicitudInscripcion(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.message, "Solicitud rechazada");
    assert.deepEqual(notifications, [["rechazada", 8]]);
  });

  if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
  }

  console.log("All tests passed");
})();
