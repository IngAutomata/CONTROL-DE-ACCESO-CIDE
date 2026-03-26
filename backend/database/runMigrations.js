const pool = require("../config/database");

async function runMigrations() {
  await pool.query(`
    ALTER TABLE usuarios
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS created_by INT REFERENCES usuarios(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS updated_by INT REFERENCES usuarios(id) ON DELETE SET NULL
  `);

  await pool.query(`
    ALTER TABLE estudiantes
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS created_by INT REFERENCES usuarios(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS updated_by INT REFERENCES usuarios(id) ON DELETE SET NULL
  `);

  await pool.query(`
    ALTER TABLE motocicletas
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS created_by INT REFERENCES usuarios(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS updated_by INT REFERENCES usuarios(id) ON DELETE SET NULL
  `);

  await pool.query(`
    ALTER TABLE movimientos
      ADD COLUMN IF NOT EXISTS created_by INT REFERENCES usuarios(id) ON DELETE SET NULL
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS auditoria (
      id SERIAL PRIMARY KEY,
      actor_user_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
      tabla VARCHAR(50) NOT NULL,
      registro_id INT,
      tipo_movimiento VARCHAR(80) NOT NULL,
      descripcion TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

module.exports = { runMigrations };
