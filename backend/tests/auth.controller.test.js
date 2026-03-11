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

function loadController({ poolMock, bcryptMock, jwtMock }) {
  const dbPath = path.resolve(__dirname, "../config/database.js");
  const bcryptPath = path.resolve(__dirname, "../node_modules/bcrypt/bcrypt.js");
  const jwtPath = path.resolve(__dirname, "../node_modules/jsonwebtoken/index.js");
  const controllerPath = path.resolve(__dirname, "../controllers/auth.controller.js");

  delete require.cache[dbPath];
  delete require.cache[bcryptPath];
  delete require.cache[jwtPath];
  delete require.cache[controllerPath];

  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: poolMock,
  };

  require.cache[bcryptPath] = {
    id: bcryptPath,
    filename: bcryptPath,
    loaded: true,
    exports: bcryptMock,
  };

  require.cache[jwtPath] = {
    id: jwtPath,
    filename: jwtPath,
    loaded: true,
    exports: jwtMock,
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
  await runTest("login normaliza role en la respuesta y el token", async () => {
    process.env.JWT_SECRET = "dev-secret";
    let signedPayload = null;

    const { login } = loadController({
      poolMock: {
        query: async () => ({
          rows: [{ id: 1, username: "admin", password_hash: "hash", role: "staff" }],
        }),
      },
      bcryptMock: {
        compare: async () => true,
      },
      jwtMock: {
        sign: (payload) => {
          signedPayload = payload;
          return "token-123";
        },
      },
    });

    const req = {
      body: {
        username: "admin",
        password: "Admin123!",
      },
    };
    const res = createRes();

    await login(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.user.role, "GUARDA");
    assert.equal(signedPayload.role, "GUARDA");
    assert.equal(res.body.token, "token-123");
  });

  await runTest("login retorna 500 si falta JWT_SECRET", async () => {
    delete process.env.JWT_SECRET;

    const { login } = loadController({
      poolMock: {
        query: async () => ({
          rows: [{ id: 1, username: "admin", password_hash: "hash", role: "ADMIN" }],
        }),
      },
      bcryptMock: {
        compare: async () => true,
      },
      jwtMock: {
        sign: () => "token-123",
      },
    });

    const req = {
      body: {
        username: "admin",
        password: "Admin123!",
      },
    };
    const res = createRes();

    await login(req, res);

    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { error: "JWT_SECRET no configurado" });
  });

  if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
  }

  console.log("All tests passed");
})();
