# Sistema de Control de Acceso con QR
Proyecto academico para registrar el ingreso y salida de estudiantes mediante lectura de codigo QR.

## Tecnologias utilizadas
- Node.js
- Express
- PostgreSQL
- bcrypt
- jsonwebtoken
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

## Requisito para aportes de codigo
Todo aporte al backend debe mantener y usar estas dependencias de autenticacion:
- `bcrypt`
- `jsonwebtoken`

Si agregas o modificas funcionalidad de auth, valida que queden declaradas en `backend/package.json` y actualizadas en `backend/package-lock.json`.
## Instalacion
### 1. Clonar repositorio
`git clone https://github.com/IngAutomata/CONTROL-DE-ACCESO-CIDE.git`

### 2. Entrar al backend
`cd CONTROL-DE-ACCESO-CIDE/backend`

### 3. Instalar dependencias
`npm install`

### 4. Configurar credenciales (.env)
Crea `backend/.env` desde el ejemplo y coloca tu password real de PostgreSQL:

```powershell
Copy-Item .env.example .env
```

Variables usadas por el backend:
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

## Autenticacion
### Login
`POST /auth/login`

Body JSON:
```json
{
  "username": "admin",
  "password": "Admin123*"
}
```

Respuesta exitosa (200):
```json
{
  "token": "<jwt>",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "ADMIN"
  }
}
```

Credenciales invalidas (401):
```json
{
  "error": "Credenciales inválidas"
}
```
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

