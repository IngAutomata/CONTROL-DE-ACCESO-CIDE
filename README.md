# SIUC - Sistema de Ingreso Universidad CIDE

Portal institucional para control de acceso del campus con roles, estudiantes, visitantes, movimientos, admisiones y trazabilidad operativa.

## Estado del MVP
El proyecto ya funciona como un MVP operativo y está centrado en el frontend React como interfaz principal.

Hoy el sistema incluye:
- inicio de sesión por roles (`ADMIN`, `GUARDA`, `CONSULTA`)
- gestión de estudiantes
- registro de entrada y salida por:
  - QR institucional
  - cédula
  - placa
- soporte de dos motos por estudiante:
  - principal
  - secundaria
- ingreso con novedad para motos no registradas
- control de quién está dentro del campus
- histórico de movimientos
- administración de usuarios y estudiantes
- soft delete y reactivación
- solicitudes públicas de inscripción
- admisiones con aprobación y rechazo
- correos SMTP
- visitantes con perfil y movimientos propios

## Tecnologías
### Backend
- Node.js
- Express
- PostgreSQL (`pg`)
- bcrypt
- jsonwebtoken
- nodemailer

### Frontend
- React
- Vite
- React Router
- html5-qrcode
- Vitest
- Testing Library

## Estructura
```text
backend/
|- config/
|- constants/
|- controllers/
|- database/
|- middleware/
|- middlewares/
|- models/
|- public/
|- routes/
|- scripts/
|- tests/
|- utils/
`- server.js

frontend/
|- src/
|  |- components/
|  |- constants/
|  |- context/
|  |- pages/
|  |- routes/
|  `- test/
|- package.json
`- vite.config.js
```

## Configuración
### 1. Backend
```powershell
cd C:\Users\Usuario\Desktop\CONTROL-DE-ACCESO-CIDE\backend
npm install
```

Crear `.env` desde `.env.example`.

Variables principales:
- `DB_USER`
- `DB_HOST`
- `DB_NAME`
- `DB_PASSWORD`
- `DB_PORT`
- `JWT_SECRET`
- `PORT`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `SMTP_CC`
- `SOLICITUDES_EXPIRE_AUTORUN`
- `SOLICITUDES_EXPIRE_INTERVAL_MS`

Ejemplo:
```env
DB_USER=postgres
DB_HOST=localhost
DB_NAME=control_acceso_cide
DB_PASSWORD=tu_password_real
DB_PORT=5432
JWT_SECRET=dev-secret
PORT=3000

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu_correo@gmail.com
SMTP_PASS=tu_app_password
SMTP_FROM=SIUC <tu_correo@gmail.com>
SMTP_CC=cristian.salazar712@cide.edu.co,kevin.vargas812@cide.edu.co

SOLICITUDES_EXPIRE_AUTORUN=true
SOLICITUDES_EXPIRE_INTERVAL_MS=300000
```

### 2. Frontend
```powershell
cd C:\Users\Usuario\Desktop\CONTROL-DE-ACCESO-CIDE\frontend
npm install
```

## Base de datos
Crear la base:
```sql
CREATE DATABASE control_acceso_cide;
```

Aplicar esquema base:
```powershell
cd C:\Users\Usuario\Desktop\CONTROL-DE-ACCESO-CIDE\backend
psql -U postgres -d control_acceso_cide -f database\schema.sql
```

Luego asegurar columnas, índices y tablas nuevas:
```powershell
node database\ensure-audit-columns.js
```

## Usuarios base
Si necesitas sembrar usuarios base:
```powershell
cd C:\Users\Usuario\Desktop\CONTROL-DE-ACCESO-CIDE\backend
node database\seed.js
```

Usuarios esperados:
- `admin / Admin123!`
- `guarda / Guarda123!`
- `consulta / Consulta123!`

## Ejecutar el sistema
### Backend
```powershell
cd C:\Users\Usuario\Desktop\CONTROL-DE-ACCESO-CIDE\backend
node server.js
```

Backend/API:
- [http://localhost:3000](http://localhost:3000)

Health:
- `GET /health`

### Frontend
```powershell
cd C:\Users\Usuario\Desktop\CONTROL-DE-ACCESO-CIDE\frontend
npm run dev
```

Frontend React:
- [http://localhost:5173](http://localhost:5173)

## Autenticación y roles
### Login
- `POST /auth/login`

Ejemplo:
```json
{
  "username": "admin",
  "password": "Admin123!"
}
```

### Usuario autenticado
- `GET /auth/me`
- requiere `Authorization: Bearer <token>`

### Roles
- `ADMIN`
- `GUARDA`
- `CONSULTA`

## Módulos principales
### Estudiantes
Permite:
- primer ingreso
- búsqueda por documento o placa
- edición controlada por rol
- dos motos registradas
- celular
- validación de QR institucional CIDE

Rutas principales:
- `POST /estudiantes/primer-ingreso`
- `GET /estudiantes`
- `GET /estudiantes/:id`
- `GET /estudiantes/documento/:documento`
- `GET /estudiantes/placa/:placa`
- `PUT /estudiantes/documento/:documento`

### Movimientos
Permite:
- entrada/salida por QR
- entrada/salida por cédula
- entrada/salida por placa
- control de moto principal / secundaria
- novedad de moto no registrada
- quién está dentro del campus
- histórico

Rutas principales:
- `POST /movimientos/registrar`
- `GET /movimientos`
- `GET /movimientos/estudiante/:id`
- `GET /movimientos/dentro-campus`

### Visitantes
Módulo separado del flujo de estudiantes.

Permite:
- registrar visitante por documento
- registrar entrada/salida
- salida rápida por placa
- ver visitantes dentro del campus
- ver histórico de visitantes
- ver perfiles registrados

Rutas:
- `POST /visitantes/registrar`
- `GET /visitantes`
- `GET /visitantes/movimientos`
- `GET /visitantes/dentro-campus`
- `GET /visitantes/documento/:documento`

### Administración
Permite:
- crear usuarios
- cambiar contraseña de usuarios
- desactivar/reactivar usuarios
- desactivar/reactivar estudiantes
- registrar salida previa antes de desactivar estudiantes si siguen dentro
- revisar estudiantes del sistema
- revisar usuarios del sistema

Importante:
- el borrado es lógico (`soft delete`)
- se conserva historial y auditoría
- `admin` principal no debe desactivarse

Rutas principales:
- `GET /admin/usuarios`
- `POST /admin/usuarios`
- `PUT /admin/usuarios/:id`
- `DELETE /admin/usuarios/:id`
- `PATCH /admin/usuarios/:id/reactivar`
- `GET /admin/estudiantes`
- `GET /admin/estudiantes/documento/:documento`
- `PUT /admin/estudiantes/:id`
- `DELETE /admin/estudiantes/:id`
- `PATCH /admin/estudiantes/:id/reactivar`
- `GET /admin/estudiantes/documento/:documento/estado-desactivacion`
- `POST /admin/estudiantes/documento/:documento/registrar-salida`

### Admisiones / Solicitudes de inscripción
Flujo nuevo para migración y autocarga controlada.

Permite:
- formulario público de inscripción
- adjuntar QR y tarjetas de propiedad
- aprobar o rechazar desde administración
- enviar correos por SMTP
- expirar solicitudes automáticamente a las 48 horas

Rutas:
- `POST /solicitudes-inscripcion`
- `GET /solicitudes-inscripcion`
- `GET /solicitudes-inscripcion/:id`
- `PATCH /solicitudes-inscripcion/:id/aprobar`
- `PATCH /solicitudes-inscripcion/:id/rechazar`

## Reglas de negocio importantes
### Estudiantes
- cédula: 8 a 10 dígitos numéricos
- celular: exactamente 10 números
- QR: formato institucional CIDE
- placa: formato válido colombiano
- máximo 2 motos por estudiante

### Novedad de moto
Si el estudiante llega con una moto no registrada:
- no se agrega automáticamente al perfil
- se registra como novedad de acceso
- requiere validación manual
- guarda:
  - placa observada
  - motivo
  - tipo de soporte (`TARJETA_PROPIEDAD` o `RUNT`)
  - responsable

### Roles
- `ADMIN`: control completo
- `GUARDA`: operación diaria y edición parcial de estudiante
- `CONSULTA`: solo lectura

### Soft delete
No se usa borrado físico para usuarios ni estudiantes.

Se desactivan para:
- conservar movimientos
- conservar responsables
- conservar auditoría

## Correos y expiración
El sistema ya puede enviar correos para:
- recepción de solicitud
- aceptación
- rechazo
- expiración

Comando manual de expiración:
```powershell
cd C:\Users\Usuario\Desktop\CONTROL-DE-ACCESO-CIDE\backend
npm run solicitudes:expire
```

Además, si `SOLICITUDES_EXPIRE_AUTORUN=true`, el backend procesa expiraciones automáticamente al arrancar, según el intervalo configurado.

## Pruebas
### Backend
```powershell
cd C:\Users\Usuario\Desktop\CONTROL-DE-ACCESO-CIDE\backend
npm test
npm run test:integration
npm run test:all
node tests\solicitudes-inscripcion.controller.test.js
node tests\visitantes.controller.test.js
```

### Frontend
```powershell
cd C:\Users\Usuario\Desktop\CONTROL-DE-ACCESO-CIDE\frontend
npm test
npm run build
```

## Demo mínima recomendada
1. levantar backend
2. levantar frontend
3. iniciar sesión como `admin`
4. registrar un estudiante
5. registrar entrada/salida por QR
6. registrar un movimiento por cédula y seleccionar moto
7. revisar `Dentro del campus`
8. crear una solicitud en `/inscripcion`
9. aprobar o rechazar desde `Administración` → `Admisiones`
10. revisar correo recibido
11. registrar un visitante y probar entrada/salida

## Notas operativas
- React es hoy el frente principal del sistema
- `backend/public` queda solo como apoyo histórico o respaldo técnico
- no integrar `frontend/dist` al repositorio
- cualquier cambio de frontend debe pasar por:
  - `npm test`
  - `npm run build`
- cualquier cambio sensible de backend debe validar pruebas y migración
