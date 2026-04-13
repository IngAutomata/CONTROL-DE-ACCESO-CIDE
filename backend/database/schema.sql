-- Usuarios (admin/staff)
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'staff',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  deactivated_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Estudiantes
CREATE TABLE IF NOT EXISTS estudiantes (
  id SERIAL PRIMARY KEY,
  documento VARCHAR(30) UNIQUE NOT NULL,
  qr_uid VARCHAR(120) UNIQUE NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  carrera VARCHAR(120) NOT NULL,
  celular VARCHAR(20),
  vigencia BOOLEAN NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMP NULL,
  created_by_user_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
  updated_by_user_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Motocicletas (1 a 1 con estudiante por MVP)
CREATE TABLE IF NOT EXISTS motocicletas (
  id SERIAL PRIMARY KEY,
  estudiante_id INT UNIQUE NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
  placa VARCHAR(15) NOT NULL,
  color VARCHAR(30) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Movimientos (entradas/salidas)
CREATE TABLE IF NOT EXISTS movimientos (
  id SERIAL PRIMARY KEY,
  estudiante_id INT NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('ENTRADA','SALIDA')),
  actor_user_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_estudiantes_created_by_user_id ON estudiantes(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_estudiantes_updated_by_user_id ON estudiantes(updated_by_user_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_actor_user_id ON movimientos(actor_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_estudiantes_celular
  ON estudiantes(celular)
  WHERE celular IS NOT NULL AND TRIM(celular) <> '';
CREATE UNIQUE INDEX IF NOT EXISTS uq_motocicletas_placa_upper
  ON motocicletas(UPPER(TRIM(placa)))
  WHERE placa IS NOT NULL AND TRIM(placa) <> '';
