-- Usuarios (admin/staff)
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'staff',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by INT REFERENCES usuarios(id) ON DELETE SET NULL,
  updated_by INT REFERENCES usuarios(id) ON DELETE SET NULL
);

-- Estudiantes
CREATE TABLE IF NOT EXISTS estudiantes (
  id SERIAL PRIMARY KEY,
  documento VARCHAR(30) UNIQUE NOT NULL,
  qr_uid VARCHAR(120) UNIQUE NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  carrera VARCHAR(120) NOT NULL,
  vigencia BOOLEAN NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by INT REFERENCES usuarios(id) ON DELETE SET NULL,
  updated_by INT REFERENCES usuarios(id) ON DELETE SET NULL
);

-- Motocicletas (1 a 1 con estudiante por MVP)
CREATE TABLE IF NOT EXISTS motocicletas (
  id SERIAL PRIMARY KEY,
  estudiante_id INT UNIQUE NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
  placa VARCHAR(15) NOT NULL,
  color VARCHAR(30) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by INT REFERENCES usuarios(id) ON DELETE SET NULL,
  updated_by INT REFERENCES usuarios(id) ON DELETE SET NULL
);

-- Movimientos (entradas/salidas)
CREATE TABLE IF NOT EXISTS movimientos (
  id SERIAL PRIMARY KEY,
  estudiante_id INT NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('ENTRADA','SALIDA')),
  fecha TIMESTAMP DEFAULT NOW(),
  created_by INT REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS auditoria (
  id SERIAL PRIMARY KEY,
  actor_user_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
  tabla VARCHAR(50) NOT NULL,
  registro_id INT,
  tipo_movimiento VARCHAR(80) NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
