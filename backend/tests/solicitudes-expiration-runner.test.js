const assert = require("node:assert/strict");
const path = require("node:path");

const runnerPath = path.resolve(__dirname, "../utils/solicitudes-expiration-runner.js");
const modelPath = path.resolve(__dirname, "../models/solicitudes-inscripcion.model.js");
const mailerPath = path.resolve(__dirname, "../utils/solicitud-mailer.js");
const dbPath = path.resolve(__dirname, "../config/database.js");

function loadRunner({ modelMock, mailerMock, dbMock }) {
  delete require.cache[runnerPath];
  delete require.cache[modelPath];
  delete require.cache[mailerPath];
  delete require.cache[dbPath];

  require.cache[modelPath] = { id: modelPath, filename: modelPath, loaded: true, exports: modelMock };
  require.cache[mailerPath] = { id: mailerPath, filename: mailerPath, loaded: true, exports: mailerMock };
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: dbMock || {} };

  return require(runnerPath);
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
  await runTest("getExpirationIntervalMs usa valor por defecto cuando la variable es inválida", async () => {
    process.env.SOLICITUDES_EXPIRE_INTERVAL_MS = "1000";

    const { getExpirationIntervalMs } = loadRunner({
      modelMock: { expirePending: async () => ({ rows: [] }) },
      mailerMock: { notifySolicitudExpirada: async () => {} },
    });

    assert.equal(getExpirationIntervalMs(), 300000);
  });

  await runTest("processExpiredSolicitudes expira y notifica cada solicitud", async () => {
    const notified = [];
    const expiradas = [
      { id: 1, correo_institucional: "uno@cide.edu.co" },
      { id: 2, correo_institucional: "dos@cide.edu.co" },
    ];

    const { processExpiredSolicitudes } = loadRunner({
      modelMock: {
        expirePending: async () => ({ rows: expiradas }),
      },
      mailerMock: {
        notifySolicitudExpirada: async (solicitud) => {
          notified.push(solicitud.id);
        },
      },
    });

    const result = await processExpiredSolicitudes({});

    assert.deepEqual(result, expiradas);
    assert.deepEqual(notified, [1, 2]);
  });

  if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
  }

  console.log("All tests passed");
})();