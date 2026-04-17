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

-- Motocicletas registradas por estudiante (maximo 2 activas: principal y secundaria)
CREATE TABLE IF NOT EXISTS motocicletas (
  id SERIAL PRIMARY KEY,
  estudiante_id INT NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
  placa VARCHAR(15) NOT NULL,
  color VARCHAR(30) NOT NULL,
  tipo VARCHAR(20) NOT NULL DEFAULT 'PRINCIPAL' CHECK (tipo IN ('PRINCIPAL', 'SECUNDARIA')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Movimientos (entradas/salidas)
CREATE TABLE IF NOT EXISTS movimientos (
  id SERIAL PRIMARY KEY,
  estudiante_id INT NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('ENTRADA','SALIDA')),
  vehiculo_placa VARCHAR(15) NULL,
  actor_user_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha TIMESTAMP DEFAULT NOW()
);

-- Novedades de acceso por moto no registrada oficialmente
CREATE TABLE IF NOT EXISTS novedades_acceso (
  id SERIAL PRIMARY KEY,
  movimiento_id INT UNIQUE NOT NULL REFERENCES movimientos(id) ON DELETE CASCADE,
  estudiante_id INT NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
  tipo_novedad VARCHAR(40) NOT NULL DEFAULT 'MOTO_NO_REGISTRADA',
  placa_observada VARCHAR(15) NOT NULL,
  motivo VARCHAR(120) NOT NULL,
  soporte_validado BOOLEAN NOT NULL DEFAULT FALSE,
  tipo_soporte VARCHAR(30) NOT NULL CHECK (tipo_soporte IN ('TARJETA_PROPIEDAD', 'RUNT')),
  observaciones TEXT NULL,
  autorizado_por_user_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_estudiantes_created_by_user_id ON estudiantes(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_estudiantes_updated_by_user_id ON estudiantes(updated_by_user_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_actor_user_id ON movimientos(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_novedades_acceso_estudiante_id ON novedades_acceso(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_novedades_acceso_autorizado_por ON novedades_acceso(autorizado_por_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_estudiantes_celular
  ON estudiantes(celular)
  WHERE celular IS NOT NULL AND TRIM(celular) <> '';
CREATE UNIQUE INDEX IF NOT EXISTS uq_motocicletas_estudiante_tipo_activa
  ON motocicletas(estudiante_id, tipo)
  WHERE is_active = TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS uq_motocicletas_placa_upper
  ON motocicletas(UPPER(TRIM(placa)))
  WHERE is_active = TRUE AND placa IS NOT NULL AND TRIM(placa) <> '';


-- Visitantes
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
);

-- Movimientos de visitantes (separados del flujo de estudiantes)
CREATE TABLE IF NOT EXISTS movimientos_visitantes (
  id SERIAL PRIMARY KEY,
  visitante_id INT NOT NULL REFERENCES visitantes(id) ON DELETE CASCADE,
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('ENTRADA','SALIDA')),
  motivo_visita VARCHAR(160) NULL,
  persona_visitada VARCHAR(120) NULL,
  observaciones TEXT NULL,
  vehiculo_placa VARCHAR(15) NULL,
  actor_user_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movimientos_visitantes_actor_user_id ON movimientos_visitantes(actor_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_visitantes_placa_upper
  ON visitantes(UPPER(TRIM(placa)))
  WHERE placa IS NOT NULL AND TRIM(placa) <> '';

-- Solicitudes de inscripción previas a aprobación administrativa
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
  estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'EXPIRADA')),
  motivo_rechazo TEXT NULL,
  notas_revision TEXT NULL,
  reviewed_by_user_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP NULL,
  expires_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '48 hours'),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_solicitudes_estado ON solicitudes_inscripcion(estado);
CREATE INDEX IF NOT EXISTS idx_solicitudes_documento ON solicitudes_inscripcion(documento);
CREATE INDEX IF NOT EXISTS idx_solicitudes_qr_uid ON solicitudes_inscripcion(qr_uid);
CREATE INDEX IF NOT EXISTS idx_solicitudes_correo ON solicitudes_inscripcion(correo_institucional);
CREATE INDEX IF NOT EXISTS idx_solicitudes_reviewed_by ON solicitudes_inscripcion(reviewed_by_user_id);

