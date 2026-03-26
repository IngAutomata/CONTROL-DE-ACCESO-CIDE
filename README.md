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
|- public/
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

Ejemplo rapido de `.env`:
```env
DB_USER=postgres
DB_HOST=localhost
DB_NAME=control_acceso_cide
DB_PASSWORD=tu_password_real
DB_PORT=5432
JWT_SECRET=dev-secret
PORT=3000
```

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

Interfaz web:
- `http://localhost:3000/`

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
- `GET /admin/usuarios/username/:username` (`ADMIN`)
- `POST /admin/usuarios` (`ADMIN`)
- `PUT /admin/usuarios/:id` (`ADMIN`)
- `DELETE /admin/usuarios/:id` (`ADMIN`)
- `PUT /admin/usuarios/username/:username` (`ADMIN`)
- `DELETE /admin/usuarios/username/:username` (`ADMIN`)
- `GET /admin/estudiantes/documento/:documento` (`ADMIN`)
- `GET /admin/estudiantes/placa/:placa` (`ADMIN`)
- `PUT /admin/estudiantes/:id` (`ADMIN`)
- `DELETE /admin/estudiantes/:id` (`ADMIN`)
- `PUT /admin/estudiantes/documento/:documento` (`ADMIN`)
- `DELETE /admin/estudiantes/documento/:documento` (`ADMIN`)

## Estado actual
- Flujo protegido por JWT en rutas sensibles.
- Roles validados desde el token del usuario autenticado.
- Controladores con manejo de errores y transacciones para operaciones criticas.
- El seed corrige usuarios base existentes para evitar roles heredados inconsistentes.
- Hay una interfaz web basica en la raiz (`/`) para login, creacion de usuarios, registro de estudiantes y verificacion de datos.
- La vista de `ADMIN` puede buscar usuarios por `username` y estudiantes por `documento` o `placa`, autocompletar campos y luego editar o eliminar sin depender de IDs visibles.
- Antes de editar o eliminar usuarios o estudiantes, la interfaz muestra un popup de confirmacion para evitar cambios accidentales.

## Pruebas
Comandos genericos:
```bash
npm test
npm run test:integration
npm run test:all
```

Comandos recomendados en PowerShell:
```powershell
cd C:\Users\Usuario\Desktop\CONTROL-DE-ACCESO-CIDE\backend
$env:DB_PASSWORD="tu_password_real"
$env:JWT_SECRET="dev-secret"
npm test
npm run test:integration
npm run test:all
```

`test:integration` requiere PostgreSQL disponible, `DB_PASSWORD` y `JWT_SECRET` configurados.

## Script de prueba manual
- PowerShell: `./test-endpoints.ps1`
- Bash: `bash test-endpoints.sh`

## Demo minima para cualquier companero
1. Copiar `.env.example` a `.env`
2. Ejecutar `npm install`
3. Crear la base y correr `database/schema.sql`
4. Ejecutar `node database/seed.js`
5. Ejecutar `npm start`
6. Abrir `http://localhost:3000/`
7. Ingresar con `admin / Admin123!`

## Prueba visual desde la pantalla
1. Iniciar sesion como `admin`
2. Pulsar `Ver /auth/me` para confirmar token
3. Buscar usuarios por `username`, autocompletar y luego crear, editar o eliminar
4. Registrar un estudiante desde `Registrar estudiante`
   - `placa` debe tener formato `ABC12D` (3 letras, 2 numeros y 1 letra final)
5. Buscar estudiantes por `documento` o `placa`, autocompletar y luego editar o eliminar
   - al editar o eliminar, aparece un popup de confirmacion
6. Buscarlo por documento en `Verificar estudiante`
7. Registrar movimiento por QR
8. Verificarlo en `Ver dentro del campus`
