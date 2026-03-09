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

## Ejecutar
```bash
npm start
```

Health:
- `GET /health`

## Autenticacion y autorizacion
1. Login: `POST /auth/login`
2. Enviar JWT en header:
- `Authorization: Bearer <token>`

Roles soportados:
- `ADMIN`
- `GUARDA`
- `CONSULTA`

## Endpoints
### Estudiantes
- `POST /estudiantes/primer-ingreso` (GUARDA)
- `GET /estudiantes` (ADMIN/GUARDA/CONSULTA)
- `GET /estudiantes/:id` (ADMIN/GUARDA/CONSULTA)
- `GET /estudiantes/documento/:documento` (ADMIN/GUARDA/CONSULTA)

### Movimientos
- `POST /movimientos/registrar` (GUARDA)
- `GET /movimientos` (ADMIN/GUARDA/CONSULTA)
- `GET /movimientos/estudiante/:id` (ADMIN/GUARDA/CONSULTA)
- `GET /movimientos/dentro-campus` (ADMIN/GUARDA)

### Admin
- `GET /admin/reportes` (ADMIN)
- `GET /admin/usuarios` (ADMIN)

## Estado actual
- Flujo protegido por JWT en rutas sensibles.
- Roles validados desde el token del usuario autenticado.
- Controladores con manejo de errores y transacciones para operaciones criticas.

## Pruebas
```bash
npm test
npm run test:integration
npm run test:all
```

## Script de prueba manual
- `bash test-endpoints.sh`
