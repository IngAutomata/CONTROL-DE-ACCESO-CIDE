# AGENT.md - Contexto del Proyecto CONTROL-DE-ACCESO-CIDE

## Objetivo
Backend academico para control de acceso de estudiantes mediante QR, con registro de ENTRADA/SALIDA en PostgreSQL.

## Stack
- Node.js (CommonJS)
- Express 5
- PostgreSQL (`pg`)

## Estructura
```text
CONTROL-DE-ACCESO-CIDE/
|- README.md
|- backend/
|  |- server.js
|  |- package.json
|  |- config/
|  |  `- database.js
|  |- controllers/
|  |  |- estudiantes.controller.js
|  |  `- movimientos.controller.js
|  |- routes/
|  |  |- estudiantes.routes.js
|  |  `- movimientos.routes.js
|  |- database/
|  |  `- schema.sql
|  `- tests/
|     |- movimientos.controller.test.js
|     `- estudiantes.controller.test.js
`- .gitignore
```

## Arquitectura
1. `server.js` levanta Express en puerto `3000`.
2. Rutas:
   - `/estudiantes` -> `routes/estudiantes.routes.js`
   - `/movimientos` -> `routes/movimientos.routes.js`
3. Controladores ejecutan SQL directo con `pool.query(...)`.

## Endpoints
### Salud
- `GET /`
- `GET /health`

### Estudiantes
- `GET /estudiantes/` (ruta de prueba)
- `POST /estudiantes/primer-ingreso`
  - Body esperado:
    - `documento` (string)
    - `qr_uid` (string)
    - `nombre` (string)
    - `carrera` (string)
    - `vigencia` (boolean)
    - `placa` (string)
    - `color` (string)
  - Comportamiento:
    - Upsert de estudiante por `documento`.
    - Actualiza `qr_uid` en el upsert.
    - Upsert de motocicleta por `estudiante_id`.

### Movimientos
- `POST /movimientos/registrar`
  - Acepta `qr_uid` o `qr_url`.
  - Busca estudiante por `estudiantes.qr_uid`.
  - Alterna `ENTRADA` / `SALIDA` segun ultimo movimiento.
- `GET /movimientos/dentro-campus`
  - Lista estudiantes cuyo ultimo movimiento es `ENTRADA`.
  - Respuesta: `{ count, estudiantes[] }`.

## Modelo de datos
### `estudiantes`
- `id` PK
- `documento` UNIQUE
- `qr_uid` UNIQUE
- `nombre`
- `carrera`
- `vigencia`
- `created_at`

### `motocicletas`
- `id` PK
- `estudiante_id` UNIQUE FK -> `estudiantes.id`
- `placa`
- `color`
- `created_at`

### `movimientos`
- `id` PK
- `estudiante_id` FK -> `estudiantes.id`
- `tipo` CHECK (`ENTRADA`, `SALIDA`)
- `fecha`

## Flujo principal
1. Registrar/actualizar estudiante + moto (`primer-ingreso`).
2. Escanear QR (`movimientos/registrar`).
3. Consultar quienes estan dentro (`movimientos/dentro-campus`).

## Migracion para entornos existentes
Si la tabla `estudiantes` ya existia sin `qr_uid`, aplicar:
```sql
ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS qr_uid VARCHAR(120);
UPDATE estudiantes SET qr_uid = documento WHERE qr_uid IS NULL;
ALTER TABLE estudiantes ALTER COLUMN qr_uid SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS estudiantes_qr_uid_key ON estudiantes(qr_uid);
```

## Calidad actual
- Tests de controlador disponibles en `backend/tests/`.
- Script de tests: `npm test` (desde `backend/`).

## Riesgos pendientes
1. Credenciales DB hardcodeadas en `config/database.js`.
2. No hay tests de integracion reales contra PostgreSQL.
3. No hay validacion formal de payload (Joi/Zod).
