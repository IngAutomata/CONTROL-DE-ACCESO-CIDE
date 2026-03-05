-- Estudiantes
CREATE TABLE IF NOT EXISTS estudiantes (
  id SERIAL PRIMARY KEY,
  documento VARCHAR(30) UNIQUE NOT NULL,
  qr_uid VARCHAR(120) UNIQUE NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  carrera VARCHAR(120) NOT NULL,
  vigencia BOOLEAN NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
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
  fecha TIMESTAMP DEFAULT NOW()
);
