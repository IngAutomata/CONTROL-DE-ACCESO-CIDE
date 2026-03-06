require("dotenv").config({ quiet: true });
const { Pool } = require("pg");

const dbPassword = process.env.DB_PASSWORD ?? process.env.PGPASSWORD;

if (typeof dbPassword !== "string" || dbPassword.length === 0) {
  throw new Error("DB_PASSWORD (o PGPASSWORD) es obligatorio para conectar con PostgreSQL.");
}

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "control_acceso_cide",
  password: dbPassword,
  port: Number(process.env.DB_PORT || 5432),
});

pool.on("error", (err) => {
  console.error("Error inesperado en pool PostgreSQL:", err);
});

module.exports = pool;
