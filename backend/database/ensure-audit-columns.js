const pool = require("../config/database");
const { clearAuditCapabilitiesCache } = require("../models/audit-capabilities.model");

async function ensureAuditColumns() {
  await pool.query(`
    ALTER TABLE usuarios
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP NULL,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()
  `);

  await pool.query(`
    ALTER TABLE estudiantes
      ADD COLUMN IF NOT EXISTS celular VARCHAR(20),
      ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL,
      ADD COLUMN IF NOT EXISTS created_by_user_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS updated_by_user_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()
  `);

  await pool.query(`
    ALTER TABLE movimientos
      ADD COLUMN IF NOT EXISTS actor_user_id INT REFERENCES usuarios(id) ON DELETE SET NULL
  `);

  await pool.query("CREATE INDEX IF NOT EXISTS idx_estudiantes_created_by_user_id ON estudiantes(created_by_user_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_estudiantes_updated_by_user_id ON estudiantes(updated_by_user_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_movimientos_actor_user_id ON movimientos(actor_user_id)");

  const duplicateCelulares = await pool.query(`
    SELECT celular, COUNT(*)::int AS total
    FROM estudiantes
    WHERE celular IS NOT NULL AND TRIM(celular) <> ''
    GROUP BY celular
    HAVING COUNT(*) > 1
    LIMIT 1
  `);

  if (duplicateCelulares.rows.length > 0) {
    const row = duplicateCelulares.rows[0];
    throw new Error(`No se pudo asegurar unicidad de celular. Duplicado encontrado: ${row.celular} (${row.total} registros).`);
  }

  const duplicatePlacas = await pool.query(`
    SELECT UPPER(TRIM(placa)) AS placa_normalizada, COUNT(*)::int AS total
    FROM motocicletas
    WHERE placa IS NOT NULL AND TRIM(placa) <> ''
    GROUP BY UPPER(TRIM(placa))
    HAVING COUNT(*) > 1
    LIMIT 1
  `);

  if (duplicatePlacas.rows.length > 0) {
    const row = duplicatePlacas.rows[0];
    throw new Error(`No se pudo asegurar unicidad de placa. Duplicado encontrado: ${row.placa_normalizada} (${row.total} registros).`);
  }

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_estudiantes_celular
    ON estudiantes (celular)
    WHERE celular IS NOT NULL AND TRIM(celular) <> ''
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_motocicletas_placa_upper
    ON motocicletas (UPPER(TRIM(placa)))
    WHERE placa IS NOT NULL AND TRIM(placa) <> ''
  `);

  clearAuditCapabilitiesCache();
}

(async () => {
  try {
    await ensureAuditColumns();
    console.log("Columnas de auditoria listas.");
    process.exit(0);
  } catch (error) {
    console.error("No se pudieron asegurar las columnas de auditoria:", error.message);
    process.exit(1);
  } finally {
    await pool.end().catch(() => null);
  }
})();
