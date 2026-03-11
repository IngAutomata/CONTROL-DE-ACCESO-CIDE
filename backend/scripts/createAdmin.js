const bcrypt = require("bcrypt");
const pool = require("../config/database");

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin123*";
const ADMIN_ROLE = "ADMIN";
const SALT_ROUNDS = 10;

async function createAdmin() {
  try {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);

    const result = await pool.query(
      `
      INSERT INTO usuarios (username, password_hash, role)
      VALUES ($1, $2, $3)
      ON CONFLICT (username) DO NOTHING
      RETURNING id
      `,
      [ADMIN_USERNAME, passwordHash, ADMIN_ROLE]
    );

    if (result.rowCount === 0) {
      console.log("Usuario admin ya existe, no se duplico");
      return;
    }

    console.log("Usuario admin creado correctamente");
  } catch (error) {
    console.error("Error creando usuario admin:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

createAdmin();
