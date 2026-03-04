# AGENT.md - Contexto del Proyecto CONTROL-DE-ACCESO-CIDE

## Objetivo del sistema
Backend academico para control de acceso de estudiantes mediante QR, con registro de ENTRADA/SALIDA en PostgreSQL.

## Stack actual
- Runtime: Node.js (CommonJS)
- Framework HTTP: Express 5
- Base de datos: PostgreSQL (`pg`)
- Estructura: backend monolitico simple por capas (routes -> controllers -> DB)

## Estructura del repositorio
```text
CONTROL-DE-ACCESO-CIDE/
|- README.md
|- .gitignore
`- backend/
   |- server.js
   |- package.json
   |- config/
   |  `- database.js
   |- controllers/
   |  |- estudiantes.controller.js
   |  `- movimientos.controller.js
   |- routes/
   |  |- estudiantes.routes.js
   |  `- movimientos.routes.js
   `- database/
      `- schema.sql
```

## Arquitectura (como funciona hoy)
1. `server.js` levanta Express en puerto `3000`.
2. `server.js` monta rutas:
   - `/estudiantes` -> `routes/estudiantes.routes.js`
   - `/movimientos` -> `routes/movimientos.routes.js`
3. Las rutas llaman controladores.
4. Los controladores ejecutan SQL directo con `pool.query(...)`.

## Endpoints implementados
### Salud
- `GET /`
  - Mensaje simple de servidor.
- `GET /health`
  - Valida conectividad a DB con `SELECT NOW()`.

### Estudiantes
- `GET /estudiantes/`
  - Ruta de prueba.
- `POST /estudiantes/primer-ingreso`
  - Body esperado:
    - `documento` (string)
    - `nombre` (string)
    - `carrera` (string)
    - `vigencia` (boolean)
    - `placa` (string)
    - `color` (string)
  - Comportamiento:
    - Upsert de estudiante por `documento`.
    - Upsert de motocicleta por `estudiante_id`.

### Movimientos
- `POST /movimientos/registrar`
  - Acepta:
    - `qr_uid` o
    - `qr_url` (extrae el ultimo segmento como UID)
  - Comportamiento:
    - Busca estudiante por `qr_uid`.
    - Lee ultimo movimiento.
    - Alterna `ENTRADA` / `SALIDA`.
    - Inserta nuevo movimiento.

## Modelo de datos (schema.sql)
### `estudiantes`
- `id` PK
- `documento` UNIQUE
- `nombre`
- `carrera`
- `vigencia`
- `created_at`

### `motocicletas`
- `id` PK
- `estudiante_id` UNIQUE FK -> `estudiantes.id` (1:1 MVP)
- `placa`
- `color`
- `created_at`

### `movimientos`
- `id` PK
- `estudiante_id` FK -> `estudiantes.id`
- `tipo` CHECK (`ENTRADA`, `SALIDA`)
- `fecha`

## Flujo funcional principal
1. Registrar/actualizar estudiante y su moto (`primer-ingreso`).
2. Escanear QR en porteria (`movimientos/registrar`).
3. Generar movimiento segun ultimo estado (entrada/salida alternada).

## Observaciones tecnicas importantes (estado actual)
1. `controllers/estudiantes.controller.js` tiene una inconsistencia estructural:
   - Define `obtenerPorDocumento` dentro de `primerIngreso`.
   - Exporta `module.exports` dos veces.
   - Resultado probable: `obtenerPorDocumento` no queda realmente expuesto/usable.
2. `movimientos.controller.js` consulta `estudiantes.qr_uid`, pero `schema.sql` no define la columna `qr_uid`.
   - Si la DB se crea solo con este schema, `POST /movimientos/registrar` fallara al buscar por QR.
3. `config/database.js` contiene credenciales hardcodeadas.
   - Recomendado: mover a variables de entorno (`.env`).
4. No hay capa de servicios, validacion formal (Joi/Zod) ni tests automatizados.
5. El `README.md` refleja bien el flujo general, pero no documenta limitaciones anteriores.

## Convenciones para nuevos features
Para mantener coherencia al extender el sistema:
1. Rutas en `routes/*.routes.js`.
2. Logica SQL/negocio en `controllers/*.controller.js`.
3. Cambios de base de datos versionados en `backend/database/` (idealmente migraciones).
4. Actualizar siempre:
   - `README.md` (uso funcional)
   - este `AGENT.md` (contexto tecnico)

## Prioridad sugerida antes de nuevos features
1. Corregir `estudiantes.controller.js` (estructura y exportaciones).
2. Alinear modelo QR:
   - agregar `qr_uid` en `schema.sql` y en `primer-ingreso`, o
   - cambiar `movimientos/registrar` para otra llave existente.
3. Externalizar credenciales DB por entorno.
4. Agregar tests de integracion minimos para endpoints criticos.

## Comandos base
Desde `backend/`:
```bash
npm install
node server.js
```
Health check:
```bash
GET http://localhost:3000/health
```

## Decision log rapido
- Arquitectura actual prioriza simplicidad para MVP academico.
- El siguiente salto de calidad debe enfocarse en consistencia de datos, seguridad de configuracion y pruebas.

## Feature agregado: Estudiantes dentro del campus
- Endpoint: `GET /movimientos/dentro-campus`.
- Definicion operacional: estudiante dentro = ultimo movimiento `ENTRADA`.
- Respuesta: `{ count, estudiantes[] }` con detalle de estudiante, moto y fecha del ultimo movimiento.
- Query basada en SQL con ultimo movimiento por estudiante y filtro por `ENTRADA`.
