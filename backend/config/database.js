const { Pool } = require("pg");

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "control_acceso_cide",
  password: process.env.DB_PASSWORD || process.env.PGPASSWORD || "postgres",
  port: Number(process.env.DB_PORT || 5432),
});

pool.on("error", (err) => {
  console.error("Error inesperado en pool PostgreSQL:", err);
});

module.exports = pool;
