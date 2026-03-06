const { Pool } = require("pg");

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "control_acceso_cide",
  password: process.env.DB_PASSWORD || process.env.PGPASSWORD || "postgres",
  port: Number(process.env.DB_PORT || 5432),
});

pool
  .connect()
  .then((client) => {
    console.log("Conectado a PostgreSQL");
    client.release();
  })
  .catch((err) => console.error("Error conexion DB:", err));

module.exports = pool;
