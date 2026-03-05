const { Pool } = require("pg");

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "control_acceso_cide",
  password: "Mas2022",
  port: 5432,
});

pool
  .connect()
  .then((client) => {
    console.log("Conectado a PostgreSQL");
    client.release();
  })
  .catch((err) => console.error("Error conexion DB:", err));

module.exports = pool;
