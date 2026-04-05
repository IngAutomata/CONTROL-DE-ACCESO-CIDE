const pool = require("../config/database");
const { clearAuditCapabilitiesCache } = require("../models/audit-capabilities.model");

async function ensureAuditColumns() {
  await pool.query(`
    ALTER TABLE estudiantes
      ADD COLUMN IF NOT EXISTS celular VARCHAR(20),
      ADD COLUMN IF NOT EXISTS created_by_user_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS updated_by_user_id INT REFERENCES usuarios(id) ON DELETE SET NULL
  `);

  await pool.query(`
    ALTER TABLE movimientos
      ADD COLUMN IF NOT EXISTS actor_user_id INT REFERENCES usuarios(id) ON DELETE SET NULL
  `);

  await pool.query("CREATE INDEX IF NOT EXISTS idx_estudiantes_created_by_user_id ON estudiantes(created_by_user_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_estudiantes_updated_by_user_id ON estudiantes(updated_by_user_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_movimientos_actor_user_id ON movimientos(actor_user_id)");

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
