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
      ADD COLUMN IF NOT EXISTS actor_user_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS vehiculo_placa VARCHAR(15) NULL
  `);

  await pool.query(`
    ALTER TABLE motocicletas
      ADD COLUMN IF NOT EXISTS tipo VARCHAR(20),
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()
  `);

  await pool.query(`
    UPDATE motocicletas
    SET tipo = 'PRINCIPAL'
    WHERE tipo IS NULL OR TRIM(tipo) = ''
  `);

  await pool.query(`
    ALTER TABLE motocicletas
      ALTER COLUMN tipo SET DEFAULT 'PRINCIPAL',
      ALTER COLUMN tipo SET NOT NULL
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_motocicletas_tipo'
      ) THEN
        ALTER TABLE motocicletas
        ADD CONSTRAINT chk_motocicletas_tipo
        CHECK (tipo IN ('PRINCIPAL', 'SECUNDARIA'));
      END IF;
    END $$;
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'motocicletas_estudiante_id_key'
      ) THEN
        ALTER TABLE motocicletas
        DROP CONSTRAINT motocicletas_estudiante_id_key;
      END IF;
    END $$;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS novedades_acceso (
      id SERIAL PRIMARY KEY,
      movimiento_id INT UNIQUE NOT NULL REFERENCES movimientos(id) ON DELETE CASCADE,
      estudiante_id INT NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
      tipo_novedad VARCHAR(40) NOT NULL DEFAULT 'MOTO_NO_REGISTRADA',
      placa_observada VARCHAR(15) NOT NULL,
      motivo VARCHAR(120) NOT NULL,
      soporte_validado BOOLEAN NOT NULL DEFAULT FALSE,
      tipo_soporte VARCHAR(30) NOT NULL,
      observaciones TEXT NULL,
      autorizado_por_user_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_novedades_tipo_soporte'
      ) THEN
        ALTER TABLE novedades_acceso
        ADD CONSTRAINT chk_novedades_tipo_soporte
        CHECK (tipo_soporte IN ('TARJETA_PROPIEDAD', 'RUNT'));
      END IF;
    END $$;
  `);

  await pool.query("CREATE INDEX IF NOT EXISTS idx_estudiantes_created_by_user_id ON estudiantes(created_by_user_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_estudiantes_updated_by_user_id ON estudiantes(updated_by_user_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_movimientos_actor_user_id ON movimientos(actor_user_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_novedades_acceso_estudiante_id ON novedades_acceso(estudiante_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_novedades_acceso_autorizado_por ON novedades_acceso(autorizado_por_user_id)");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS visitantes (
      id SERIAL PRIMARY KEY,
      documento VARCHAR(30) UNIQUE NOT NULL,
      nombre VARCHAR(120) NOT NULL,
      celular VARCHAR(20) NOT NULL,
      placa VARCHAR(15) NULL,
      entidad VARCHAR(120) NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS movimientos_visitantes (
      id SERIAL PRIMARY KEY,
      visitante_id INT NOT NULL REFERENCES visitantes(id) ON DELETE CASCADE,
      tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('ENTRADA', 'SALIDA')),
      motivo_visita VARCHAR(160) NULL,
      persona_visitada VARCHAR(120) NULL,
      observaciones TEXT NULL,
      vehiculo_placa VARCHAR(15) NULL,
      actor_user_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
      fecha TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query("CREATE INDEX IF NOT EXISTS idx_movimientos_visitantes_actor_user_id ON movimientos_visitantes(actor_user_id)");
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_visitantes_placa_upper
    ON visitantes (UPPER(TRIM(placa)))
    WHERE placa IS NOT NULL AND TRIM(placa) <> ''
  `);

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
    CREATE UNIQUE INDEX IF NOT EXISTS uq_motocicletas_estudiante_tipo_activa
    ON motocicletas (estudiante_id, tipo)
    WHERE is_active = TRUE
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_motocicletas_placa_upper
    ON motocicletas (UPPER(TRIM(placa)))
    WHERE is_active = TRUE AND placa IS NOT NULL AND TRIM(placa) <> ''
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS solicitudes_inscripcion (
      id SERIAL PRIMARY KEY,
      documento VARCHAR(30) NOT NULL,
      qr_uid VARCHAR(120) NOT NULL,
      nombre VARCHAR(120) NOT NULL,
      carrera VARCHAR(120) NOT NULL,
      correo_institucional VARCHAR(150) NOT NULL,
      celular VARCHAR(20) NOT NULL,
      placa VARCHAR(15) NOT NULL,
      color VARCHAR(30) NOT NULL,
      placa_secundaria VARCHAR(15) NULL,
      color_secundaria VARCHAR(30) NULL,
      qr_imagen_url TEXT NOT NULL,
      tarjeta_propiedad_principal_url TEXT NOT NULL,
      tarjeta_propiedad_secundaria_url TEXT NULL,
      autoriza_tratamiento_datos BOOLEAN NOT NULL DEFAULT FALSE,
      estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
      motivo_rechazo TEXT NULL,
      notas_revision TEXT NULL,
      reviewed_by_user_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
      reviewed_at TIMESTAMP NULL,
      expires_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '48 hours'),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_solicitudes_estado'
      ) THEN
        ALTER TABLE solicitudes_inscripcion
        ADD CONSTRAINT chk_solicitudes_estado
        CHECK (estado IN ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'EXPIRADA'));
      END IF;
    END $$;
  `);

  await pool.query("CREATE INDEX IF NOT EXISTS idx_solicitudes_estado ON solicitudes_inscripcion(estado)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_solicitudes_documento ON solicitudes_inscripcion(documento)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_solicitudes_qr_uid ON solicitudes_inscripcion(qr_uid)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_solicitudes_correo ON solicitudes_inscripcion(correo_institucional)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_solicitudes_reviewed_by ON solicitudes_inscripcion(reviewed_by_user_id)");

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
