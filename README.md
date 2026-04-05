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

frontend/
|- index.html
|- package.json
|- vite.config.js
`- src/
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

Frontend React base (`SIU`):
1. `cd frontend`
2. `npm install`
3. `npm run dev`

Vista React:
- `http://localhost:5173/`

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
- `GET /estudiantes/placa/:placa` (`ADMIN`, `GUARDA`, `CONSULTA`)

### Movimientos
- `POST /movimientos/registrar` (`ADMIN` o `GUARDA`)
- `GET /movimientos` (`ADMIN`, `GUARDA`, `CONSULTA`)
- `GET /movimientos/estudiante/:id` (`ADMIN`, `GUARDA`, `CONSULTA`)
- `GET /movimientos/dentro-campus` (`ADMIN`, `GUARDA`, `CONSULTA`)

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
- Se agrego una base de frontend React en `frontend/` bajo la identidad `SIU` (`Sistema de Ingreso Universidad CIDE`).
- El frontend React ya compila, respeta la politica de sesion del proyecto y esta siendo alineado visualmente con el estilo institucional tipo SOE.
- El frontend React ya permite leer QR reales con la camara del computador para dos flujos:
  - cargar `qr_uid` en el primer registro del estudiante
  - registrar automaticamente `ENTRADA` o `SALIDA` en movimientos usando el mismo QR
- La interfaz actual estable para operacion diaria sigue siendo la de `backend/public`; el React se trabaja en paralelo hasta completar la migracion visual y funcional.
- La base ya soporta auditoria de responsables para estudiantes y movimientos; los registros nuevos o editados despues de correr `ensure-audit-columns.js` ya pueden mostrar `Creado por`, `Actualizado por` y `Responsable`.

## Estado del frontend React
Objetivo: construir una version moderna del portal sin romper la interfaz operativa actual.

### Ya corregido
- sesion con `sessionStorage`
- recuperacion de sesion al recargar
- timeout por inactividad de 15 minutos
- acceso por rol alineado con backend
- busqueda de estudiantes por documento o placa
- edicion de estudiantes usando `PUT /estudiantes/documento/:documento`
- modulo `ADMIN` desacoplado de endpoints no estables
- branding `SIU` y primera alineacion visual con estilo institucional
- lectura QR por camara del computador con `html5-qrcode`
- registro automatico de entrada/salida desde escaneo real en la pantalla de movimientos
- ajustes visuales y textuales en `Login`, `Dashboard`, `Estudiantes` y `Movimientos`
- placeholders mas claros para acceso, busqueda y formularios
- mejor consistencia en botones secundarios, estados vacios y mensajes de estado
- build validado con `npm run build`

### Aun en trabajo
- sidebar y layout mas cercanos al SOE
- tablas, cards y jerarquia visual del portal
- dashboard con lenguaje visual academico
- homologacion visual total frente a la interfaz de `backend/public`

### Lectura QR en React
Objetivo: permitir operacion real mientras el hardware `ESP32-CAM` sigue pendiente.

Flujo disponible:
1. En `frontend/src/pages/Estudiantes.jsx`, el boton de camara permite escanear un QR real y llenar `qr_uid`.
2. Al guardar el formulario, ese `qr_uid` queda persistido en base de datos como identificador del estudiante.
3. En `frontend/src/pages/Movimientos.jsx`, el boton de camara detecta el mismo QR y envia el valor a `POST /movimientos/registrar`.
4. El backend decide automaticamente si corresponde `ENTRADA` o `SALIDA` segun el ultimo movimiento registrado.

Notas:
- si el QR contiene una URL completa, el backend extrae el ultimo segmento como `qr_uid`
- la camara del navegador requiere permisos del dispositivo
- para desarrollo local, mantener backend y React corriendo al tiempo

### Pantallas React revisadas recientemente
- `frontend/src/pages/Login.jsx`
- `frontend/src/pages/Dashboard.jsx`
- `frontend/src/pages/Estudiantes.jsx`
- `frontend/src/pages/Movimientos.jsx`
- `frontend/src/styles.css`

Cambios aplicados:
- revision de textos visibles, placeholders y mensajes cortos
- mejora de claridad en formularios de acceso, estudiantes y movimientos
- mejor lectura visual de mensajes informativos y estados vacios
- ajustes pequenos de espaciado, hover y consistencia en botones secundarios
- mejor respiracion visual en tarjetas y paneles en pantallas pequenas

### Regla importante
- no integrar `frontend/dist` al repositorio
- no reemplazar `backend/public` hasta que el flujo React quede validado
- cualquier cambio en React debe compilar con `npm run build`

## Flujo de trabajo frontend para 4 personas
Objetivo: permitir que el equipo avance en frontend mientras termina pendientes de backend, sin pisarse ni romper contratos ya usados por la interfaz.

### Regla general antes de empezar
1. Trabajar siempre desde `develop`.
2. No cambiar por cuenta propia nombres de endpoints, campos JSON o roles sin avisar al equipo.
3. Cada persona debe tocar un bloque distinto de la interfaz para evitar conflictos.
4. Antes de subir cambios, validar al menos:
   - `node --check backend/public/app.js`
   - abrir `http://localhost:3000/`
   - probar el flujo que modificaron

### Reparto de trabajo sugerido
#### Cristian
Responsabilidad: tablas operativas y visualizacion de datos.

Tareas:
- mejorar tabla de usuarios
- mejorar tabla de estudiantes
- mejorar tabla de historial de movimientos
- agregar estados vacios mas claros
- agregar scroll horizontal y lectura mas comoda en movil

Archivos principales:
- `backend/public/index.html`
- `backend/public/styles.css`
- `backend/public/app.js`

#### Kevin
Responsabilidad: experiencia por rol y seguridad visual.

Tareas:
- pulir experiencia `ADMIN`, `GUARDA` y `CONSULTA`
- revisar que botones y paneles visibles coincidan con permisos reales
- mejorar mensajes de permiso insuficiente
- reforzar estados de sesion, token y resumen operativo

Archivos principales:
- `backend/public/app.js`
- `backend/public/styles.css`

#### Maicol
Responsabilidad: mejoras visuales sencillas y contenido estatico.

Tareas:
- revisar textos visibles en botones, titulos y ayudas
- corregir ortografia o mensajes poco claros
- mejorar placeholders y textos guia del formulario
- apoyar estilos simples:
  - espaciados
  - tamanos de letra
  - colores de badges y tarjetas
- probar en pantalla que no se vea desordenado en desktop y movil

Nota:
- Maicol no debe tocar logica compleja de fetch, roles o renderizado principal.
- Su enfoque debe ser visual, textual y de prueba manual.

Archivos principales:
- `backend/public/index.html`
- `backend/public/styles.css`

#### Tu
Responsabilidad: pantallas de login/perfil y monitoreo/dashboard, ademas de integracion final.

Tareas:
- ser dueno de la pantalla de login y perfil
- mejorar la experiencia de inicio de sesion
- mejorar visualizacion de sesion activa, token y rol
- ser dueno de la pantalla de monitoreo
- mejorar dashboard de operacion
- mejorar bloque de `Dentro del campus`
- mejorar bloque de historial de movimientos
- conectar mejor resumen operativo, metricas y actividad reciente
- revisar PRs o cambios de cada companero
- integrar el dashboard con los bloques nuevos
- validar consistencia visual general
- revisar que frontend siga alineado con backend
- ejecutar pruebas antes de aprobar merge interno
- decidir cuando `develop` esta lista para pasar a `main`

Pantallas asignadas:
- `Login / Perfil / Estado de sesion`
- `Monitoreo y Dashboard`

Archivos principales:
- `backend/public/index.html`
- `backend/public/styles.css`
- `backend/public/app.js`
- `README.md` cuando cambie el flujo

### Que debe hacer cada uno apenas termine backend
#### Cristian
1. Tomar tablas operativas y estados vacios.
2. Mejorar visualizacion de usuarios, estudiantes y movimientos.

#### Kevin
1. Tomar restricciones por rol en la interfaz.
2. Revisar experiencia de `ADMIN`, `GUARDA` y `CONSULTA`.

#### Maicol
1. Tomar ajustes de textos, placeholders y estilos simples.
2. Hacer pruebas manuales de visualizacion y orden.

#### Tu
1. Tomar `Login / Perfil / Estado de sesion`.
2. Tomar `Monitoreo y Dashboard`.
3. Mejorar metricas, resumen operativo, dentro del campus e historial.
4. Coordinar integracion.
5. Validar que nada rompa login, dashboard, busqueda guiada e historial.

### Orden recomendado de ejecucion
1. Primero terminar pendientes de backend.
2. Luego cada integrante toma su bloque frontend.
3. Despues se integran cambios en `develop`.
4. Se prueban flujos reales:
   - login
   - usuarios
   - estudiantes
   - movimientos
   - dentro del campus
   - historial
5. Solo despues de esa validacion se considera merge a `main`.

## Forma de trabajo recomendada desde ahora
Para evitar desorden en frontend, seguir siempre este ciclo:

1. Elegir un solo bloque por jornada:
   - `login`
   - `sidebar/layout`
   - `dashboard`
   - `estudiantes`
   - `movimientos`
   - `admin`
2. No mezclar en el mismo cambio:
   - ajustes visuales
   - cambios funcionales
   - integracion general
3. Antes de editar, dejar claro:
   - que pantalla se va a tocar
   - que archivos se van a tocar
   - que resultado se espera
4. Antes de subir cambios de React validar:
```bash
cd frontend
npm run build
```
5. Antes de subir cambios de `backend/public` validar:
```bash
cd backend
node --check public/app.js
```
6. Probar siempre en navegador el flujo tocado antes de push.

## Bloques sugeridos para continuar el React
1. `Login y sesion`
2. `Sidebar y layout institucional`
3. `Dashboard`
4. `Estudiantes`
5. `Movimientos`
6. `Admin`

Cada bloque debe cerrar con:
- revision visual
- build exitoso
- prueba manual
- commit limpio

### Definition of done para frontend
Un bloque frontend se considera listo cuando:
- se ve bien en la pantalla
- no rompe otros modulos
- respeta roles
- muestra mensajes claros
- funciona con datos reales del backend
- fue probado manualmente por quien lo hizo

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
