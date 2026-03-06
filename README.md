# Sistema de Control de Acceso con QR
Proyecto academico para registrar el ingreso y salida de estudiantes mediante lectura de codigo QR.

## Tecnologias utilizadas
- Node.js
- Express
- PostgreSQL
- Git / GitHub

## Arquitectura del proyecto
backend
|- config
|  `- database.js
|- controllers
|  |- estudiantes.controller.js
|  `- movimientos.controller.js
|- routes
|  |- estudiantes.routes.js
|  `- movimientos.routes.js
|- database
|  `- schema.sql
`- server.js

## Instalacion
### 1. Clonar repositorio
`git clone https://github.com/IngAutomata/CONTROL-DE-ACCESO-CIDE.git`

### 2. Entrar al backend
`cd CONTROL-DE-ACCESO-CIDE/backend`

### 3. Instalar dependencias
`npm install`

### 4. Configurar variables de entorno
Copia el archivo de ejemplo y ajusta tu password real de PostgreSQL:

```powershell
Copy-Item .env.example .env
```

Variables esperadas:
- `DB_USER`
- `DB_HOST`
- `DB_NAME`
- `DB_PASSWORD`
- `DB_PORT`

## Base de datos
### Crear la base de datos
`CREATE DATABASE control_acceso_cide;`

### Ejecutar el schema
`psql -U postgres -d control_acceso_cide -f database/schema.sql`

## Ejecutar servidor
`node server.js`

### Health check
`http://localhost:3000/health`

## Pruebas
- Unitarias: `npm test`
- Integracion: `npm run test:integration`

## Registro de estudiante
### Endpoint
`POST /estudiantes/primer-ingreso`

### Ejemplo en PowerShell
```powershell
Invoke-RestMethod -Method POST -Uri "http://localhost:3000/estudiantes/primer-ingreso" -ContentType "application/json" -Body '{
  "documento":"123456",
  "qr_uid":"NjA5MTgy",
  "nombre":"Luis Ramon",
  "carrera":"Ingenieria Mecatronica",
  "vigencia":true,
  "placa":"ABC123",
  "color":"Negro"
}'
```

## Registro de acceso con QR
### Endpoint
`POST /movimientos/registrar`

### Ejemplo en PowerShell
```powershell
Invoke-RestMethod -Method POST -Uri "http://localhost:3000/movimientos/registrar" -ContentType "application/json" -Body '{
  "qr_uid":"NjA5MTgy"
}'
```

## Ver estudiantes dentro del campus
### Endpoint
`GET /movimientos/dentro-campus`

### Regla de negocio
Un estudiante esta dentro del campus si su ultimo movimiento es `ENTRADA`.

### Ejemplo en PowerShell
```powershell
Invoke-RestMethod -Method GET -Uri "http://localhost:3000/movimientos/dentro-campus"
```

### Ejemplo de respuesta
```json
{
  "count": 2,
  "estudiantes": [
    {
      "estudiante_id": 1,
      "documento": "123456",
      "nombre": "Luis Ramon",
      "carrera": "Ingenieria Mecatronica",
      "vigencia": true,
      "placa": "ABC123",
      "color": "Negro",
      "ultimo_movimiento": "ENTRADA",
      "fecha_ultimo_movimiento": "2026-03-04T14:10:00.000Z"
    }
  ]
}
```

## Flujo del sistema
QR carnet estudiante
        -> lector QR
        -> Backend Node.js
        -> PostgreSQL
        -> Registro de acceso

### Si ya tenias la tabla `estudiantes` creada
Ejecuta esta migracion para alinear el flujo QR:
```sql
ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS qr_uid VARCHAR(120);
UPDATE estudiantes SET qr_uid = documento WHERE qr_uid IS NULL;
ALTER TABLE estudiantes ALTER COLUMN qr_uid SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS estudiantes_qr_uid_key ON estudiantes(qr_uid);
```

## Roles y permisos
Roles disponibles:
- `ADMIN`: gestiona usuarios/reportes.
- `GUARDA`: registra `primer-ingreso` y `movimientos`.
- `CONSULTA`: rol de lectura.

Header requerido para rutas protegidas:
- `x-role: ADMIN | GUARDA | CONSULTA`

Matriz aplicada en esta rama:
- `POST /estudiantes/primer-ingreso` -> `GUARDA`
- `POST /movimientos/registrar` -> `GUARDA`
- `GET /movimientos/dentro-campus` -> `GUARDA`, `ADMIN`
- `GET /admin/*` -> `ADMIN`
- `GET /estudiantes/:documento` -> `ADMIN`, `GUARDA`, `CONSULTA`
