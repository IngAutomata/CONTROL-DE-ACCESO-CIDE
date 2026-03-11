# Sistema de Control de Acceso con QR

Backend academico para registrar entradas y salidas con QR.

## Tecnologias
- Node.js
- Express
- PostgreSQL (`pg`)
- bcrypt
- jsonwebtoken

## Estructura
```text
backend/
|- config/database.js
|- controllers/
|- models/
|- middleware/
|- middlewares/
|- routes/
|- database/schema.sql
`- server.js
```

## Configuracion
1. `cd backend`
2. `npm install`
3. Crear `.env` desde `.env.example`.

Variables requeridas:
- `DB_USER`
- `DB_HOST`
- `DB_NAME`
- `DB_PASSWORD`
- `DB_PORT`
- `JWT_SECRET`
- `PORT` (opcional)

## Base de datos
```sql
CREATE DATABASE control_acceso_cide;
```

Ejecutar schema:
```bash
psql -U postgres -d control_acceso_cide -f database/schema.sql
```

Seed de usuarios base:
```bash
node database/seed.js
```

Usuarios creados/actualizados por el seed:
- `admin / Admin123!` -> `ADMIN`
- `guarda / Guarda123!` -> `GUARDA`
- `consulta / Consulta123!` -> `CONSULTA`

## Ejecutar
```bash
npm start
```

Health:
- `GET /health`

## Autenticacion y autorizacion
1. Login: `POST /auth/login`
Body JSON:
```json
{
  "username": "admin",
  "password": "Admin123!"
}
```

Respuesta exitosa:
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

2. Perfil autenticado: `GET /auth/me`
Header requerido:
- `Authorization: Bearer <token>`

Respuesta exitosa:
```json
{
  "id": 1,
  "username": "admin",
  "role": "ADMIN"
}
```

Roles soportados:
- `ADMIN`
- `GUARDA`
- `CONSULTA`

## Endpoints
Todas las rutas protegidas requieren `Authorization: Bearer <token>`.

### Estudiantes
- `POST /estudiantes/primer-ingreso` (`ADMIN` o `GUARDA`)
- `GET /estudiantes` (`ADMIN`, `GUARDA`, `CONSULTA`)
- `GET /estudiantes/:id` (`ADMIN`, `GUARDA`, `CONSULTA`)
- `GET /estudiantes/documento/:documento` (`ADMIN`, `GUARDA`, `CONSULTA`)

### Movimientos
- `POST /movimientos/registrar` (`ADMIN` o `GUARDA`)
- `GET /movimientos` (`ADMIN`, `GUARDA`, `CONSULTA`)
- `GET /movimientos/estudiante/:id` (`ADMIN`, `GUARDA`, `CONSULTA`)
- `GET /movimientos/dentro-campus` (`ADMIN` o `GUARDA`)

### Admin
- `GET /admin/reportes` (`ADMIN`)
- `GET /admin/usuarios` (`ADMIN`)

## Estado actual
- Flujo protegido por JWT en rutas sensibles.
- Roles validados desde el token del usuario autenticado.
- Controladores con manejo de errores y transacciones para operaciones criticas.
- El seed corrige usuarios base existentes para evitar roles heredados inconsistentes.

## Pruebas
```bash
npm test
npm run test:integration
npm run test:all
```

`test:integration` requiere PostgreSQL disponible, `DB_PASSWORD` y `JWT_SECRET` configurados.

## Script de prueba manual
- PowerShell: `./test-endpoints.ps1`
- Bash: `bash test-endpoints.sh`
