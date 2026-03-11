const assert = require("node:assert/strict");

const { requireRole } = require("../middleware/requireRole");
const { ROLES } = require("../constants/roles");

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
  await runTest("requireRole retorna 401 cuando no hay req.user", async () => {
    const req = {};
    const res = createRes();
    let nextCalled = false;

    requireRole(ROLES.GUARDA)(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, "Token requerido");
  });

  await runTest("requireRole retorna 403 cuando rol es invalido", async () => {
    const req = { user: { role: "HACKER" } };
    const res = createRes();

    requireRole(ROLES.GUARDA)(req, res, () => {});

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error, "Rol no valido");
  });

  await runTest("requireRole retorna 403 cuando el rol no tiene permiso", async () => {
    const req = { user: { role: "CONSULTA" } };
    const res = createRes();

    requireRole(ROLES.GUARDA)(req, res, () => {});

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error, "No tienes permisos para este recurso");
  });

  await runTest("requireRole permite cuando el rol esta autorizado", async () => {
    const req = { user: { role: "guarda" } };
    const res = createRes();
    let nextCalled = false;

    requireRole(ROLES.GUARDA, ROLES.ADMIN)(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(req.userRole, "GUARDA");
    assert.equal(res.statusCode, 200);
  });

  if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
  }

  console.log("All tests passed");
})();
