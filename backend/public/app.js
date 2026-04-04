const output = document.getElementById("output");
const sessionRole = document.getElementById("session-role");
const sessionToken = document.getElementById("session-token");
const sessionPermissions = document.getElementById("session-permissions");
const sessionSummaryCopy = document.getElementById("session-summary-copy");
const roleBadges = document.getElementById("role-badges");
const sessionStatePill = document.getElementById("session-state-pill");
const sessionUserChip = document.getElementById("session-user-chip");
const sessionRoleChip = document.getElementById("session-role-chip");
const sessionAccessChip = document.getElementById("session-access-chip");
const studentSearchHint = document.getElementById("student-search-hint");
const studentNextStep = document.getElementById("student-next-step");
const studentSearchMode = document.getElementById("student-search-mode");
const lookupDocumentoGroup = document.getElementById("lookup-documento-group");
const lookupPlacaGroup = document.getElementById("lookup-placa-group");
const metricInside = document.getElementById("metric-inside");
const metricStudents = document.getElementById("metric-students");
const metricUsers = document.getElementById("metric-users");
const metricLastMovement = document.getElementById("metric-last-movement");
const dashboardStatus = document.getElementById("dashboard-status");
const dashboardCopy = document.getElementById("dashboard-copy");
const dashboardPriority = document.getElementById("dashboard-priority");
const dashboardActions = document.getElementById("dashboard-actions");
const alerts = document.getElementById("alerts");
const confirmModal = document.getElementById("confirm-modal");
const modalMessage = document.getElementById("modal-message");
const modalDetails = document.getElementById("modal-details");
const modalConfirmBtn = document.getElementById("modal-confirm-btn");
const modalCancelBtn = document.getElementById("modal-cancel-btn");
const usersTableWrap = document.getElementById("users-table-wrap");
const studentsTableWrap = document.getElementById("students-table-wrap");
const insideTableWrap = document.getElementById("inside-table-wrap");
const movementsTableWrap = document.getElementById("movements-table-wrap");
const usersMeta = document.getElementById("users-meta");
const studentsMeta = document.getElementById("students-meta");
const insideMeta = document.getElementById("inside-meta");
const movementsMeta = document.getElementById("movements-meta");
const insideCountCard = document.getElementById("inside-count-card");
const insideLatestCard = document.getElementById("inside-latest-card");
const movementsCountCard = document.getElementById("movements-count-card");
const movementsLastCard = document.getElementById("movements-last-card");
const SESSION_TIMEOUT_MS = 15 * 60 * 1000;
const ACTIVITY_EVENTS = ["click", "keydown", "mousemove", "scroll", "touchstart"];

let authToken = sessionStorage.getItem("access_token") || localStorage.getItem("access_token") || "";
let currentUser = JSON.parse(sessionStorage.getItem("auth_user") || localStorage.getItem("auth_user") || "null");
const userForm = document.getElementById("user-form");
const studentForm = document.getElementById("student-form");
let selectedUsername = "";
let selectedStudentDocumento = "";
let pendingConfirmAction = null;
let cachedUsers = [];
let cachedStudents = [];
let cachedInsideCampus = [];
let cachedMovements = [];
let activeStudentSearchMode = "documento";
let inactivityTimer = null;
const allRoleLabels = ["ADMIN", "GUARDA", "CONSULTA"];

const roleCapabilities = {
  ADMIN: {
    summary: "Gestion completa de usuarios, estudiantes, monitoreo y consultas del sistema.",
    permissions: "Usuarios, estudiantes, monitoreo y acciones sensibles",
    active: ["ADMIN", "GUARDA", "CONSULTA"],
  },
  GUARDA: {
    summary: "Operacion de porteria: registrar estudiantes, verificar datos y consultar monitoreo.",
    permissions: "Registro, verificacion y monitoreo",
    active: ["GUARDA", "CONSULTA"],
  },
  CONSULTA: {
    summary: "Modo de consulta: verificar informacion y revisar estudiantes en campus sin modificar datos.",
    permissions: "Solo lectura operativa",
    active: ["CONSULTA"],
  },
};

localStorage.removeItem("access_token");
localStorage.removeItem("auth_user");

function persistAuthState() {
  if (!authToken || !currentUser) return;
  sessionStorage.setItem("access_token", authToken);
  sessionStorage.setItem("auth_user", JSON.stringify(currentUser));
}

function clearAuthState() {
  sessionStorage.removeItem("access_token");
  sessionStorage.removeItem("auth_user");
  localStorage.removeItem("access_token");
  localStorage.removeItem("auth_user");
}

function clearInactivityTimer() {
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }
}

function performLogout(reason = "manual") {
  authToken = "";
  currentUser = null;
  clearAuthState();
  clearInactivityTimer();
  cachedUsers = [];
  cachedStudents = [];
  cachedInsideCampus = [];
  cachedMovements = [];
  refreshSessionUI();
  resetUserSelection();
  resetStudentSelection();
  renderEmptyState(usersTableWrap, usersMeta, "Carga el listado de usuarios para ver acciones por fila.");
  renderEmptyState(studentsTableWrap, studentsMeta, "Carga el listado de estudiantes para ver acciones por fila.");
  renderEmptyState(insideTableWrap, insideMeta, "Consulta dentro del campus para ver el estado en una tabla.");
  renderEmptyState(movementsTableWrap, movementsMeta, "Consulta movimientos para ver entradas y salidas recientes.");
  printResult("Sesion cerrada", { ok: true, reason });

  if (reason === "timeout") {
    showAlert("warn", "Sesion cerrada por inactividad", "Pasaron 15 minutos sin actividad. Debes iniciar sesion de nuevo.");
    return;
  }

  showAlert("info", "Sesion cerrada", "La sesion actual se cerro correctamente.");
}

function scheduleInactivityLogout() {
  clearInactivityTimer();
  if (!authToken) return;

  inactivityTimer = setTimeout(() => {
    performLogout("timeout");
  }, SESSION_TIMEOUT_MS);
}

function registerActivity() {
  if (!authToken) return;
  scheduleInactivityLogout();
}

function applyAuthMode() {
  document.body.classList.toggle("authenticated", Boolean(authToken));
}

function refreshSessionUI() {
  applyAuthMode();
  sessionRole.textContent = currentUser ? `${currentUser.username} / ${currentUser.role}` : "Sin iniciar";
  sessionToken.textContent = authToken ? "Disponible" : "No disponible";
  const roleInfo = currentUser ? roleCapabilities[currentUser.role] : null;
  sessionPermissions.textContent = roleInfo ? roleInfo.permissions : "Inicia sesion para ver tus permisos";
  sessionSummaryCopy.textContent = roleInfo
    ? roleInfo.summary
    : "Sin sesion activa. Inicia con admin, guarda o consulta.";
  roleBadges.innerHTML = allRoleLabels.map((role) => `
    <span class="role-pill ${roleInfo && roleInfo.active.includes(role) ? "active" : "muted"}">${role}</span>
  `).join("");
  sessionStatePill.textContent = authToken ? "Activa" : "Sin sesion";
  sessionStatePill.className = `session-pill ${authToken ? "active" : "inactive"}`;
  sessionUserChip.textContent = currentUser?.username || "Sin autenticar";
  sessionRoleChip.textContent = currentUser?.role || "Sin rol";
  sessionAccessChip.textContent = roleInfo?.permissions || "Solo portada";
  if (!authToken) {
    printResult("Acceso institucional", {
      message: "Inicia sesion para cargar el flujo operativo segun tu rol.",
    });
  }
  syncRoleVisibility();
  refreshDashboard();
}

function syncRoleVisibility() {
  const role = currentUser?.role || "";
  const isAdmin = role === "ADMIN";
  const isGuard = role === "GUARDA";
  const isAuthenticated = Boolean(authToken);
  const isConsulta = role === "CONSULTA";
  const canRead = isAuthenticated && (isAdmin || isGuard || isConsulta);

  document.querySelectorAll(".role-admin-only").forEach((panel) => {
    panel.hidden = !isAdmin;
  });

  document.querySelectorAll(".role-admin-guard").forEach((panel) => {
    panel.classList.toggle("panel-locked", !isAdmin && !isGuard);
  });

  document.querySelectorAll(".role-authenticated").forEach((panel) => {
    panel.classList.toggle("panel-locked", !isAuthenticated);
  });

  document.querySelectorAll(".role-read-only").forEach((panel) => {
    panel.classList.toggle("panel-locked", !canRead);
  });

  document.querySelectorAll("#update-user-btn, #delete-user-btn, #users-btn, [data-user-action=\"edit\"], [data-user-action=\"delete\"]")
    .forEach((button) => {
      button.disabled = !isAdmin;
    });

  document.querySelectorAll("#update-student-btn, [data-student-action=\"edit\"]")
    .forEach((button) => {
      button.disabled = !(isAdmin || isGuard);
    });

  document.querySelectorAll("#delete-student-btn, [data-student-action=\"delete\"]")
    .forEach((button) => {
      button.disabled = !isAdmin;
    });

  const studentSubmit = studentForm.querySelector("button[type=\"submit\"]");
  if (studentSubmit) {
    studentSubmit.disabled = !(isAdmin || isGuard);
  }

  const searchStudentButton = document.getElementById("search-student-btn");
  if (searchStudentButton) {
    searchStudentButton.disabled = !(isAdmin || isGuard);
  }

  const movementSubmit = document.querySelector("#movement-form button[type=\"submit\"]");
  if (movementSubmit) {
    movementSubmit.disabled = !isAuthenticated;
  }

  const insideButton = document.getElementById("inside-btn");
  if (insideButton) {
    insideButton.disabled = !canRead;
  }

  const studentsButton = document.getElementById("students-btn");
  if (studentsButton) {
    studentsButton.disabled = !canRead;
  }

  const movementsButton = document.getElementById("movements-btn");
  if (movementsButton) {
    movementsButton.disabled = !canRead;
  }
}

function normalizeErrorPayload(error) {
  if (!error) {
    return { error: "Ocurrio un error desconocido" };
  }

  if (error.data && typeof error.data === "object") {
    return error.status ? { status: error.status, ...error.data } : error.data;
  }

  if (error.data) {
    return error.status ? { status: error.status, error: error.data } : { error: error.data };
  }

  if (error instanceof Error) {
    return { error: error.message };
  }

  if (typeof error === "string") {
    return { error };
  }

  return error;
}

function printResult(title, payload, isError = false) {
  output.classList.toggle("error", isError);
  const finalPayload = isError ? normalizeErrorPayload(payload) : payload;
  output.textContent = `${title}\n\n${JSON.stringify(finalPayload, null, 2)}`;
}

function showAlert(type, title, message) {
  const alert = document.createElement("article");
  alert.className = `alert ${type}`;
  alert.innerHTML = `
    <p class="alert-title">${escapeHtml(title)}</p>
    <p class="alert-copy">${escapeHtml(message)}</p>
  `;

  alerts.appendChild(alert);

  setTimeout(() => {
    alert.remove();
  }, 4200);
}

function requireAuth(actionLabel) {
  if (authToken) return true;

  printResult(
    "Sesion requerida",
    {
      error: `Debes iniciar sesion antes de ${actionLabel}.`,
      hint: "Usa admin / Admin123! o guarda / Guarda123! en el bloque Login.",
    },
    true
  );
  showAlert("warn", "Sesion requerida", `Debes iniciar sesion antes de ${actionLabel}.`);

  return false;
}

function normalizePlate(value) {
  return value.trim().toUpperCase();
}

function ensureAdmin(actionLabel) {
  if (!requireAuth(actionLabel)) return false;

  if (currentUser && currentUser.role === "ADMIN") return true;

  printResult(
    "Permiso insuficiente",
    { error: `Solo ADMIN puede ${actionLabel}.` },
    true
  );
  showAlert("warn", "Permiso insuficiente", `Solo ADMIN puede ${actionLabel}.`);
  return false;
}

function ensureAdminOrGuard(actionLabel) {
  if (!requireAuth(actionLabel)) return false;

  if (currentUser && (currentUser.role === "ADMIN" || currentUser.role === "GUARDA")) return true;

  printResult(
    "Permiso insuficiente",
    { error: `Solo ADMIN o GUARDA puede ${actionLabel}.` },
    true
  );
  showAlert("warn", "Permiso insuficiente", `Solo ADMIN o GUARDA puede ${actionLabel}.`);
  return false;
}

function ensureReadAccess(actionLabel) {
  if (!requireAuth(actionLabel)) return false;

  if (currentUser && ["ADMIN", "GUARDA", "CONSULTA"].includes(currentUser.role)) return true;

  printResult(
    "Permiso insuficiente",
    { error: `No tienes permisos para ${actionLabel}.` },
    true
  );
  showAlert("warn", "Permiso insuficiente", `No tienes permisos para ${actionLabel}.`);
  return false;
}

function buildUserPayload(formData, { requireAllFields = false } = {}) {
  const username = (formData.get("username") || "").trim();
  const password = formData.get("password") || "";
  const role = formData.get("role");
  const payload = {};

  if (requireAllFields || username) payload.username = username;
  if (requireAllFields || password) payload.password = password;
  if (requireAllFields || role) payload.role = role;

  return payload;
}

function buildStudentPayload(formData) {
  return {
    documento: (formData.get("documento") || "").trim(),
    qr_uid: (formData.get("qr_uid") || "").trim(),
    nombre: (formData.get("nombre") || "").trim(),
    carrera: (formData.get("carrera") || "").trim(),
    placa: normalizePlate(formData.get("placa") || ""),
    color: (formData.get("color") || "").trim(),
    vigencia: formData.get("vigencia") === "on",
  };
}

function setStudentNextStep(message) {
  studentNextStep.textContent = message;
}

function formatMovementSummary(student) {
  if (!student) return "Sin movimiento reciente";
  const movement = student.tipo || student.ultimo_movimiento || "ENTRADA";
  const name = student.nombre || student.documento || "Registro";
  return `${movement} · ${name}`;
}

function refreshDashboard() {
  metricUsers.textContent = String(cachedUsers.length || 0);
  metricStudents.textContent = String(cachedStudents.length || 0);
  metricInside.textContent = String(cachedInsideCampus.length || 0);
  metricLastMovement.textContent = formatMovementSummary(cachedMovements[0] || cachedInsideCampus[0]);

  const setActions = (actions = []) => {
    dashboardActions.innerHTML = actions
      .map((action) => `<span class="quick-action-chip">${escapeHtml(action)}</span>`)
      .join("");
  };

  if (!currentUser) {
    dashboardStatus.textContent = "Sin sesion";
    dashboardCopy.textContent = "Inicia sesion y carga tablas para ver un estado consolidado del sistema.";
    dashboardPriority.textContent = "Comienza con login y luego consulta estudiantes o monitoreo.";
    setActions([
      "Inicia sesion",
      "Activa el panel",
      "Carga estudiantes",
    ]);
    return;
  }

  const visibleItems = cachedStudents.length + cachedInsideCampus.length + cachedUsers.length + cachedMovements.length;
  dashboardStatus.textContent = visibleItems > 0 ? `${currentUser.role} activo` : `${currentUser.role} listo`;

  if (currentUser.role === "ADMIN") {
    dashboardCopy.textContent = `Tienes ${cachedUsers.length} usuario(s), ${cachedStudents.length} estudiante(s) y ${cachedInsideCampus.length} presencia(s) activas visibles en la consola.`;
    dashboardPriority.textContent = cachedUsers.length
      ? "Prioriza revisar monitoreo y mantener actualizada la base de usuarios."
      : "Carga el listado de usuarios para completar la vista operativa del administrador.";
    setActions([
      "Listar usuarios",
      "Revisar monitoreo",
      "Validar historial",
    ]);
    return;
  }

  if (currentUser.role === "GUARDA") {
    dashboardCopy.textContent = `${cachedInsideCampus.length} estudiante(s) aparecen dentro del campus y ${cachedStudents.length} registro(s) estan disponibles para consulta operativa.`;
    dashboardPriority.textContent = "Prioriza buscar por documento o placa y registrar movimientos en tiempo real.";
    setActions([
      "Buscar estudiante",
      "Registrar movimiento",
      "Ver dentro del campus",
    ]);
    return;
  }

  dashboardCopy.textContent = `${cachedStudents.length} estudiante(s) y ${cachedInsideCampus.length} presencia(s) visibles para consulta.`;
  dashboardPriority.textContent = "Usa la vista de consulta para verificar informacion sin modificar registros.";
  setActions([
    "Consultar estudiantes",
    "Ver historial",
    "Revisar presencia",
  ]);
}

function flashStudentFormReady() {
  studentForm.classList.remove("form-guided-ready");
  void studentForm.offsetWidth;
  studentForm.classList.add("form-guided-ready");
}

function updateStudentSearchMode(mode = "documento") {
  activeStudentSearchMode = mode;
  const byDocumento = mode === "documento";

  lookupDocumentoGroup.classList.toggle("lookup-active", byDocumento);
  lookupDocumentoGroup.classList.toggle("lookup-muted", !byDocumento);
  lookupPlacaGroup.classList.toggle("lookup-active", !byDocumento);
  lookupPlacaGroup.classList.toggle("lookup-muted", byDocumento);

  studentSearchMode.querySelectorAll("[data-search-mode]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.searchMode === mode);
  });

  if (byDocumento) {
    studentSearchHint.textContent = "Usa el documento para cargar un estudiante ya registrado o para confirmar si debes crear uno nuevo.";
    studentForm.elements.lookup_placa.value = "";
    setStudentNextStep("Escribe el documento y pulsa buscar. Si existe, cargaremos el formulario completo. Si no existe, puedes registrarlo de inmediato.");
  } else {
    studentSearchHint.textContent = "Usa la placa cuando la moto ya esta en porteria y necesitas ubicar rapido al estudiante asociado.";
    studentForm.elements.lookup_documento.value = "";
    setStudentNextStep("Escribe la placa con formato ABC12D. Si existe, traeremos el estudiante listo para editar o verificar.");
  }
}

function fillUserForm(user) {
  userForm.elements.lookup_username.value = user.username || "";
  userForm.elements.username.value = user.username || "";
  userForm.elements.password.value = "";
  userForm.elements.role.value = user.role || "CONSULTA";
  selectedUsername = user.username || "";
}

function fillStudentForm(student) {
  studentForm.elements.lookup_documento.value = student.documento || "";
  studentForm.elements.lookup_placa.value = student.placa || "";
  studentForm.elements.documento.value = student.documento || "";
  studentForm.elements.qr_uid.value = student.qr_uid || "";
  studentForm.elements.nombre.value = student.nombre || "";
  studentForm.elements.carrera.value = student.carrera || "";
  studentForm.elements.placa.value = student.placa || "";
  studentForm.elements.color.value = student.color || "";
  studentForm.elements.vigencia.checked = Boolean(student.vigencia);
  selectedStudentDocumento = student.documento || "";
  setStudentNextStep(`Estudiante cargado. Revisa los datos y decide si deseas editar, verificar o eliminar a ${student.nombre || "este registro"}.`);
  flashStudentFormReady();
  refreshDashboard();
}

function resetUserSelection() {
  selectedUsername = "";
}

function resetStudentSelection() {
  selectedStudentDocumento = "";
  setStudentNextStep("Busca por documento o placa. Si lo encontramos, cargaremos el formulario para editarlo o verificarlo.");
  refreshDashboard();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderEmptyState(target, metaTarget, message, meta = "Sin cargar") {
  target.className = "table-wrap empty-state";
  target.innerHTML = escapeHtml(message);
  metaTarget.textContent = meta;
  if (target === insideTableWrap) {
    insideCountCard.textContent = "0";
    insideLatestCard.textContent = "Sin datos";
  }
  if (target === movementsTableWrap) {
    movementsCountCard.textContent = "0";
    movementsLastCard.textContent = "Sin datos";
  }
  syncRoleVisibility();
  refreshDashboard();
}

function renderUsersTable(users = []) {
  cachedUsers = users;

  if (!users.length) {
    renderEmptyState(usersTableWrap, usersMeta, "No hay usuarios para mostrar.", "0 usuarios");
    return;
  }

  usersMeta.textContent = `${users.length} usuario(s)`;
  usersTableWrap.className = "table-wrap";
  usersTableWrap.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Username</th>
          <th>Rol</th>
          <th>Creado</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${users.map((user) => `
          <tr>
            <td>${escapeHtml(user.username)}</td>
            <td><span class="badge">${escapeHtml(user.role)}</span></td>
            <td>${escapeHtml(user.created_at || "N/D")}</td>
            <td>
              <div class="row-actions">
                <button type="button" class="ghost mini-btn" data-user-action="view" data-username="${escapeHtml(user.username)}">Ver</button>
                <button type="button" class="ghost mini-btn" data-user-action="edit" data-username="${escapeHtml(user.username)}">Editar</button>
                <button type="button" class="danger mini-btn" data-user-action="delete" data-username="${escapeHtml(user.username)}">Eliminar</button>
              </div>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
  syncRoleVisibility();
  refreshDashboard();
}

function renderMovementsTable(movements = []) {
  cachedMovements = movements;
  movementsCountCard.textContent = String(movements.length || 0);
  movementsLastCard.textContent = movements.length
    ? `${movements[0].tipo || "ENTRADA"} - ${movements[0].nombre || movements[0].documento || "Registro"}`
    : "Sin datos";

  if (!movements.length) {
    renderEmptyState(movementsTableWrap, movementsMeta, "No hay movimientos recientes para mostrar.", "0 movimientos");
    return;
  }

  movementsMeta.textContent = `${movements.length} movimiento(s) visibles`;
  movementsTableWrap.className = "table-wrap";
  movementsTableWrap.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Tipo</th>
          <th>Estudiante</th>
          <th>Placa</th>
          <th>Fecha</th>
        </tr>
      </thead>
      <tbody>
        ${movements.map((movement) => `
          <tr>
            <td><span class="badge ${movement.tipo === "SALIDA" ? "exit" : "success"}">${escapeHtml(movement.tipo || "N/D")}</span></td>
            <td>
              <div class="movement-cell-strong">
                <span class="movement-main">${escapeHtml(movement.nombre || "N/D")}</span>
                <span class="movement-sub">Doc ${escapeHtml(movement.documento || "N/D")}</span>
              </div>
            </td>
            <td><span class="movement-plate">${escapeHtml(movement.placa || "N/D")}</span></td>
            <td>
              <div class="movement-meta-stack">
                <span class="movement-time">${escapeHtml(movement.fecha || movement.fecha_hora || "N/D")}</span>
              </div>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
  syncRoleVisibility();
  refreshDashboard();
}

function renderStudentsTable(students = []) {
  cachedStudents = students;

  if (!students.length) {
    renderEmptyState(studentsTableWrap, studentsMeta, "No hay estudiantes para mostrar.", "0 estudiantes");
    return;
  }

  studentsMeta.textContent = `${students.length} estudiante(s)`;
  studentsTableWrap.className = "table-wrap";
  studentsTableWrap.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Documento</th>
          <th>Nombre</th>
          <th>Carrera</th>
          <th>Placa</th>
          <th>Vigencia</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${students.map((student) => `
          <tr>
            <td>${escapeHtml(student.documento)}</td>
            <td>${escapeHtml(student.nombre)}</td>
            <td>${escapeHtml(student.carrera)}</td>
            <td>${escapeHtml(student.placa || "N/D")}</td>
            <td><span class="badge ${student.vigencia ? "success" : "warn"}">${student.vigencia ? "Vigente" : "Inactivo"}</span></td>
            <td>
              <div class="row-actions">
                <button type="button" class="ghost mini-btn" data-student-action="view" data-documento="${escapeHtml(student.documento)}">Ver</button>
                <button type="button" class="ghost mini-btn" data-student-action="edit" data-documento="${escapeHtml(student.documento)}">Editar</button>
                <button type="button" class="danger mini-btn" data-student-action="delete" data-documento="${escapeHtml(student.documento)}">Eliminar</button>
              </div>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
  syncRoleVisibility();
  refreshDashboard();
}

function renderInsideCampusTable(students = []) {
  cachedInsideCampus = students;
  insideCountCard.textContent = String(students.length || 0);
  insideLatestCard.textContent = students.length
    ? `${students[0].nombre || students[0].documento || "Registro"} · ${students[0].fecha_ultimo_movimiento || "N/D"}`
    : "Sin datos";

  if (!students.length) {
    renderEmptyState(insideTableWrap, insideMeta, "No hay estudiantes dentro del campus en este momento.", "0 dentro");
    return;
  }

  insideMeta.textContent = `${students.length} dentro del campus`;
  insideTableWrap.className = "table-wrap";
  insideTableWrap.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Estudiante</th>
          <th>Carrera</th>
          <th>Placa</th>
          <th>Ultimo movimiento</th>
          <th>Fecha</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${students.map((student) => `
          <tr>
            <td>
              <div class="student-cell-strong">
                <span class="student-main">${escapeHtml(student.nombre)}</span>
                <span class="student-sub">Doc ${escapeHtml(student.documento)}</span>
              </div>
            </td>
            <td>${escapeHtml(student.carrera)}</td>
            <td>${escapeHtml(student.placa || "N/D")}</td>
            <td><span class="badge success">${escapeHtml(student.ultimo_movimiento || "ENTRADA")}</span></td>
            <td><span class="movement-time">${escapeHtml(student.fecha_ultimo_movimiento || "N/D")}</span></td>
            <td>
              <div class="row-actions">
                <button type="button" class="ghost mini-btn" data-student-action="view" data-documento="${escapeHtml(student.documento)}">Ver</button>
                <button type="button" class="ghost mini-btn" data-student-action="edit" data-documento="${escapeHtml(student.documento)}">Editar</button>
                <button type="button" class="danger mini-btn" data-student-action="delete" data-documento="${escapeHtml(student.documento)}">Eliminar</button>
              </div>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
  syncRoleVisibility();
  refreshDashboard();
}

async function refreshUsersTableData({ silent = false } = {}) {
  if (!authToken || !currentUser || currentUser.role !== "ADMIN") return;

  try {
    const data = await apiFetch("/admin/usuarios");
    renderUsersTable(data.usuarios || []);
    if (!silent) {
      printResult("Usuarios del sistema", data);
    }
  } catch (error) {
    if (!silent) {
      printResult("Error listando usuarios", error, true);
    }
  }
}

async function refreshStudentsTableData({ silent = false } = {}) {
  if (!authToken) return;

  try {
    const data = await apiFetch("/estudiantes");
    renderStudentsTable(data.estudiantes || []);
    if (!silent) {
      printResult("Listado de estudiantes", data);
    }
  } catch (error) {
    if (!silent) {
      printResult("Error listando estudiantes", error, true);
    }
  }
}

async function refreshInsideCampusTableData({ silent = false } = {}) {
  if (!authToken) return;

  try {
    const data = await apiFetch("/movimientos/dentro-campus");
    renderInsideCampusTable(data.estudiantes || []);
    if (!silent) {
      printResult("Estudiantes dentro del campus", data);
    }
  } catch (error) {
    if (!silent) {
      printResult("Error consultando dentro del campus", error, true);
    }
  }
}

async function refreshMovementsTableData({ silent = false } = {}) {
  if (!authToken) return;

  try {
    const data = await apiFetch("/movimientos");
    const visibleMovements = (data.movimientos || []).slice(0, 12);
    renderMovementsTable(visibleMovements);
    if (!silent) {
      printResult("Historial de movimientos", { ...data, movimientos: visibleMovements });
    }
  } catch (error) {
    if (!silent) {
      printResult("Error listando movimientos", error, true);
    }
  }
}

async function loadOperationalSnapshot() {
  if (!authToken || !currentUser) return;

  const loaders = [refreshMovementsTableData({ silent: true })];

  if (currentUser.role === "ADMIN") {
    loaders.push(refreshUsersTableData({ silent: true }));
  }

  if (["ADMIN", "GUARDA", "CONSULTA"].includes(currentUser.role)) {
    loaders.push(refreshStudentsTableData({ silent: true }));
    loaders.push(refreshInsideCampusTableData({ silent: true }));
  }

  await Promise.all(loaders);
}

async function bootstrapSession() {
  if (!authToken) {
    refreshSessionUI();
    return;
  }

  refreshSessionUI();
  scheduleInactivityLogout();

  try {
    const profile = await apiFetch("/auth/me");
    currentUser = profile;
    persistAuthState();
    refreshSessionUI();
    scheduleInactivityLogout();
    await loadOperationalSnapshot();
  } catch (error) {
    if (error?.status === 401 || error?.status === 403) {
      clearAuthState();
      authToken = "";
      currentUser = null;
      clearInactivityTimer();
      refreshSessionUI();
      resetOperationalTables();
      return;
    }

    printResult("Sesion en verificacion", {
      warning: "No se pudo revalidar la sesion al recargar, pero la mantendremos mientras se restablece la conexion.",
      detalle: normalizeErrorPayload(error),
    });
    showAlert("warn", "Sesion pendiente de verificacion", "La sesion se mantuvo. Intenta usar el sistema nuevamente en unos segundos.");
  }
}

function formatConfirmDetails(details) {
  if (!details) return "";

  return Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
}

function openConfirmModal(message, details, action) {
  pendingConfirmAction = action;
  modalMessage.textContent = message;
  modalDetails.textContent = formatConfirmDetails(details);
  confirmModal.classList.remove("hidden");
  confirmModal.setAttribute("aria-hidden", "false");
  modalConfirmBtn.focus();
}

function closeConfirmModal() {
  pendingConfirmAction = null;
  confirmModal.classList.add("hidden");
  confirmModal.setAttribute("aria-hidden", "true");
}

async function runWithConfirmation(message, details, action) {
  return new Promise((resolve) => {
    openConfirmModal(message, details, async () => {
      try {
        await action();
      } finally {
        resolve();
      }
    });
  });
}

async function apiFetch(url, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const text = await response.text();
  let data = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch (_) {
      data = { error: text };
    }
  }

  if (!response.ok) {
    throw { status: response.status, data };
  }

  return data;
}

document.getElementById("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);

  try {
    const data = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        username: formData.get("username"),
        password: formData.get("password"),
      }),
    });

    authToken = data.token;
    currentUser = data.user;
    persistAuthState();
    refreshSessionUI();
    scheduleInactivityLogout();
    await loadOperationalSnapshot();
    printResult("Login exitoso", data);
    showAlert("success", "Sesion iniciada", `Bienvenido, ${data.user.username}.`);
  } catch (error) {
    printResult("Error en login", error, true);
    showAlert("error", "No fue posible iniciar sesion", normalizeErrorPayload(error).error || "Verifica tus credenciales.");
  }
});

document.getElementById("profile-btn").addEventListener("click", async () => {
  if (!requireAuth("consultar el perfil")) return;

  try {
    const data = await apiFetch("/auth/me");
    printResult("Perfil autenticado", data);
  } catch (error) {
    printResult("Error consultando perfil", error, true);
  }
});

document.getElementById("logout-btn").addEventListener("click", () => {
  performLogout("manual");
});

modalConfirmBtn.addEventListener("click", async () => {
  const action = pendingConfirmAction;
  closeConfirmModal();

  if (action) {
    await action();
  }
});

modalCancelBtn.addEventListener("click", () => {
  closeConfirmModal();
});

confirmModal.addEventListener("click", (event) => {
  if (event.target.dataset.closeModal === "true") {
    closeConfirmModal();
  }
});

document.getElementById("user-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!ensureAdmin("crear usuarios")) return;

  const form = event.currentTarget;
  const formData = new FormData(form);

  try {
    const data = await apiFetch("/admin/usuarios", {
      method: "POST",
      body: JSON.stringify(buildUserPayload(formData, { requireAllFields: true })),
    });

    printResult("Usuario creado", data);
    form.reset();
    fillUserForm(data.usuario);
    await refreshUsersTableData({ silent: true });
    showAlert("success", "Usuario creado", `Se creo el usuario ${data.usuario.username}.`);
  } catch (error) {
    printResult("Error creando usuario", error, true);
    showAlert("error", "No se pudo crear el usuario", normalizeErrorPayload(error).error || "Revisa los datos enviados.");
  }
});

document.getElementById("users-btn").addEventListener("click", async () => {
  if (!ensureAdmin("listar usuarios")) return;
  await refreshUsersTableData();
});

document.getElementById("search-user-btn").addEventListener("click", async () => {
  if (!ensureAdmin("buscar usuarios")) return;

  const lookupUsername = (userForm.elements.lookup_username.value || userForm.elements.username.value || "").trim();

  if (!lookupUsername) {
    printResult("Error buscando usuario", { error: "Debes indicar un username" }, true);
    return;
  }

  try {
    const data = await apiFetch(`/admin/usuarios/username/${encodeURIComponent(lookupUsername)}`);
    fillUserForm(data);
    printResult("Usuario encontrado", data);
    showAlert("info", "Usuario encontrado", `Se cargaron los datos de ${data.username}.`);
  } catch (error) {
    printResult("Error buscando usuario", error, true);
    showAlert("error", "Usuario no encontrado", normalizeErrorPayload(error).error || "No se pudo cargar el usuario.");
  }
});

document.getElementById("update-user-btn").addEventListener("click", async () => {
  if (!ensureAdmin("editar usuarios")) return;

  const formData = new FormData(userForm);
  const lookupUsername = (userForm.elements.lookup_username.value || selectedUsername || "").trim();

  if (!lookupUsername) {
    printResult("Error editando usuario", { error: "Debes buscar primero un usuario por username" }, true);
    return;
  }

  await runWithConfirmation(
    "Se va a editar este usuario. ¿Estas seguro de que deseas modificarlo?",
    {
      username_actual: lookupUsername,
      username_nuevo: formData.get("username"),
      role_nuevo: formData.get("role"),
      password_cambiara: formData.get("password") ? "Si" : "No",
    },
    async () => {
      try {
        const data = await apiFetch(`/admin/usuarios/username/${encodeURIComponent(lookupUsername)}`, {
          method: "PUT",
          body: JSON.stringify(buildUserPayload(formData)),
        });

        fillUserForm(data.usuario);
        printResult("Usuario actualizado", data);
        await refreshUsersTableData({ silent: true });
        showAlert("success", "Usuario actualizado", `Se actualizo el usuario ${data.usuario.username}.`);
      } catch (error) {
        printResult("Error editando usuario", error, true);
        showAlert("error", "No se pudo actualizar el usuario", normalizeErrorPayload(error).error || "Revisa los datos del formulario.");
      }
    }
  );
});

document.getElementById("delete-user-btn").addEventListener("click", async () => {
  if (!ensureAdmin("eliminar usuarios")) return;

  const lookupUsername = (userForm.elements.lookup_username.value || selectedUsername || "").trim();

  if (!lookupUsername) {
    printResult("Error eliminando usuario", { error: "Debes buscar primero un usuario por username" }, true);
    return;
  }

  await runWithConfirmation(
    "Se va a eliminar este usuario. ¿Estas seguro de que deseas continuar?",
    {
      username: lookupUsername,
      role: userForm.elements.role.value,
    },
    async () => {
      try {
        const data = await apiFetch(`/admin/usuarios/username/${encodeURIComponent(lookupUsername)}`, {
          method: "DELETE",
        });

        printResult("Usuario eliminado", data);
        userForm.reset();
        resetUserSelection();
        await refreshUsersTableData({ silent: true });
        showAlert("success", "Usuario eliminado", `Se elimino el usuario ${data.usuario.username}.`);
      } catch (error) {
        printResult("Error eliminando usuario", error, true);
        showAlert("error", "No se pudo eliminar el usuario", normalizeErrorPayload(error).error || "Intenta de nuevo.");
      }
    }
  );
});

document.getElementById("student-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!ensureAdminOrGuard("registrar estudiantes")) return;

  const form = event.currentTarget;
  const formData = new FormData(form);
  const payload = buildStudentPayload(formData);

  if (!/^[A-Z]{3}\d{2}[A-Z]$/.test(payload.placa)) {
    printResult(
      "Error registrando estudiante",
      { error: "La placa debe tener formato ABC12D" },
      true
    );
    return;
  }

  try {
    const data = await apiFetch("/estudiantes/primer-ingreso", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    printResult("Estudiante registrado", data);
    form.reset();
    fillStudentForm({ ...payload, ...data.estudiante, placa: payload.placa, color: payload.color });
    await refreshStudentsTableData({ silent: true });
    await refreshInsideCampusTableData({ silent: true });
    await refreshMovementsTableData({ silent: true });
    setStudentNextStep(`Registro completado. ${payload.nombre} ya quedo disponible para futuras busquedas por documento o placa.`);
    showAlert("success", "Estudiante registrado", `Se registro el estudiante ${payload.nombre}.`);
  } catch (error) {
    printResult("Error registrando estudiante", error, true);
    setStudentNextStep("No se pudo registrar. Ajusta documento, QR o placa y vuelve a intentarlo.");
    showAlert("error", "No se pudo registrar el estudiante", normalizeErrorPayload(error).error || "Revisa documento, QR y placa.");
  }
});

document.getElementById("search-student-btn").addEventListener("click", async () => {
  if (!ensureAdminOrGuard("buscar estudiantes")) return;

  const lookupDocumento = (studentForm.elements.lookup_documento.value || studentForm.elements.documento.value || "").trim();
  const lookupPlaca = normalizePlate(studentForm.elements.lookup_placa.value || studentForm.elements.placa.value || "");
  const shouldSearchByDocumento = activeStudentSearchMode === "documento";

  if (shouldSearchByDocumento && !lookupDocumento) {
    printResult("Error buscando estudiante", { error: "Debes indicar un documento" }, true);
    setStudentNextStep("Ingresa un documento para intentar cargar el estudiante o confirmar si debes registrarlo.");
    return;
  }

  if (!shouldSearchByDocumento && !lookupPlaca) {
    printResult("Error buscando estudiante", { error: "Debes indicar una placa" }, true);
    setStudentNextStep("Ingresa una placa con formato ABC12D para buscar al estudiante asociado.");
    return;
  }

  try {
    const data = shouldSearchByDocumento
      ? await apiFetch(`/estudiantes/documento/${encodeURIComponent(lookupDocumento)}`)
      : await apiFetch(`/estudiantes/placa/${encodeURIComponent(lookupPlaca)}`);

    fillStudentForm(data);
    printResult("Estudiante encontrado", data);
    showAlert("info", "Estudiante encontrado", `Se cargaron los datos de ${data.nombre}.`);
  } catch (error) {
    printResult("Error buscando estudiante", error, true);
    if (shouldSearchByDocumento) {
      studentForm.elements.documento.value = lookupDocumento;
      studentForm.elements.lookup_placa.value = "";
      setStudentNextStep(`No encontramos el documento ${lookupDocumento}. Puedes continuar llenando el formulario para registrar un estudiante nuevo.`);
    } else {
      studentForm.elements.placa.value = lookupPlaca;
      studentForm.elements.lookup_documento.value = "";
      setStudentNextStep(`No encontramos la placa ${lookupPlaca}. Si es una moto nueva, termina el formulario para registrar al estudiante.`);
    }
    flashStudentFormReady();
    showAlert("error", "No se pudo encontrar el estudiante", normalizeErrorPayload(error).error || "Verifica documento o placa.");
  }
});

document.getElementById("update-student-btn").addEventListener("click", async () => {
  if (!ensureAdminOrGuard("editar estudiantes")) return;

  const formData = new FormData(studentForm);
  const payload = buildStudentPayload(formData);
  const lookupDocumento = (studentForm.elements.lookup_documento.value || selectedStudentDocumento || "").trim();

  if (!lookupDocumento) {
    printResult("Error editando estudiante", { error: "Debes buscar primero un estudiante por documento o placa" }, true);
    return;
  }

  if (!/^[A-Z]{3}\d{2}[A-Z]$/.test(payload.placa)) {
    printResult("Error editando estudiante", { error: "La placa debe tener formato ABC12D" }, true);
    return;
  }

  await runWithConfirmation(
    "Se va a editar este estudiante. ¿Estas seguro de que deseas modificarlo?",
    {
      documento_actual: lookupDocumento,
      documento_nuevo: payload.documento,
      nombre: payload.nombre,
      carrera: payload.carrera,
      placa: payload.placa,
      color: payload.color,
      vigencia: payload.vigencia ? "Activa" : "Inactiva",
    },
    async () => {
      try {
        const data = await apiFetch(`/estudiantes/documento/${encodeURIComponent(lookupDocumento)}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });

        fillStudentForm({ ...payload, ...data.estudiante, placa: payload.placa, color: payload.color });
        printResult("Estudiante actualizado", data);
        await refreshStudentsTableData({ silent: true });
        await refreshInsideCampusTableData({ silent: true });
        setStudentNextStep(`Actualizacion completada. ${payload.nombre} ya quedo al dia en la base de datos.`);
        showAlert("success", "Estudiante actualizado", `Se actualizo el estudiante ${payload.nombre}.`);
      } catch (error) {
        printResult("Error editando estudiante", error, true);
        setStudentNextStep("No se pudo actualizar. Revisa los datos cargados y vuelve a intentar.");
        showAlert("error", "No se pudo actualizar el estudiante", normalizeErrorPayload(error).error || "Revisa los datos del estudiante.");
      }
    }
  );
});

document.getElementById("delete-student-btn").addEventListener("click", async () => {
  if (!ensureAdmin("eliminar estudiantes")) return;

  const lookupDocumento = (studentForm.elements.lookup_documento.value || selectedStudentDocumento || "").trim();

  if (!lookupDocumento) {
    printResult("Error eliminando estudiante", { error: "Debes buscar primero un estudiante por documento o placa" }, true);
    return;
  }

  await runWithConfirmation(
    "Se va a eliminar este estudiante. ¿Estas seguro de que deseas continuar?",
    {
      documento: lookupDocumento,
      nombre: studentForm.elements.nombre.value,
      placa: studentForm.elements.placa.value,
    },
    async () => {
      try {
        const data = await apiFetch(`/admin/estudiantes/documento/${encodeURIComponent(lookupDocumento)}`, {
          method: "DELETE",
        });

        printResult("Estudiante eliminado", data);
        studentForm.reset();
        resetStudentSelection();
        await refreshStudentsTableData({ silent: true });
        await refreshInsideCampusTableData({ silent: true });
        setStudentNextStep(`El registro ${lookupDocumento} fue eliminado. Puedes buscar otro estudiante o registrar uno nuevo.`);
        showAlert("success", "Estudiante eliminado", `Se elimino el estudiante ${lookupDocumento}.`);
      } catch (error) {
        printResult("Error eliminando estudiante", error, true);
        setStudentNextStep("No se pudo eliminar. Recarga el registro y verifica el estado antes de intentarlo otra vez.");
        showAlert("error", "No se pudo eliminar el estudiante", normalizeErrorPayload(error).error || "Intenta de nuevo.");
      }
    }
  );
});

document.querySelector('input[name="placa"]').addEventListener("input", (event) => {
  event.target.value = normalizePlate(event.target.value).slice(0, 6);
});

document.querySelector('input[name="lookup_placa"]').addEventListener("input", (event) => {
  event.target.value = normalizePlate(event.target.value).slice(0, 6);
});

studentSearchMode.addEventListener("click", (event) => {
  const button = event.target.closest("[data-search-mode]");
  if (!button) return;
  updateStudentSearchMode(button.dataset.searchMode);
});

document.getElementById("document-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!ensureReadAccess("consultar estudiantes")) return;

  const formData = new FormData(event.currentTarget);

  try {
    const data = await apiFetch(`/estudiantes/documento/${encodeURIComponent(formData.get("documento"))}`);
    printResult("Estudiante encontrado", data);
    showAlert("info", "Consulta completada", `Documento ${data.documento} encontrado.`);
  } catch (error) {
    printResult("Error consultando estudiante", error, true);
    showAlert("error", "No se pudo consultar el estudiante", normalizeErrorPayload(error).error || "Verifica el documento.");
  }
});

document.getElementById("movement-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!ensureAdminOrGuard("registrar movimientos")) return;

  const formData = new FormData(event.currentTarget);

  try {
    const data = await apiFetch("/movimientos/registrar", {
      method: "POST",
      body: JSON.stringify({
        qr_uid: formData.get("qr_input"),
      }),
    });
    printResult("Movimiento registrado", data);
    await refreshInsideCampusTableData({ silent: true });
    await refreshMovementsTableData({ silent: true });
    showAlert("success", "Movimiento registrado", data.message || "El movimiento se registro correctamente.");
  } catch (error) {
    printResult("Error registrando movimiento", error, true);
    showAlert("error", "No se pudo registrar el movimiento", normalizeErrorPayload(error).error || "Verifica el QR.");
  }
});

document.getElementById("inside-btn").addEventListener("click", async () => {
  if (!ensureReadAccess("consultar estudiantes dentro del campus")) return;
  await refreshInsideCampusTableData();
});

document.getElementById("students-btn").addEventListener("click", async () => {
  if (!ensureReadAccess("listar estudiantes")) return;
  await refreshStudentsTableData();
});

document.getElementById("movements-btn").addEventListener("click", async () => {
  if (!ensureReadAccess("consultar movimientos recientes")) return;
  await refreshMovementsTableData();
});

usersTableWrap.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-user-action]");
  if (!button) return;

  const action = button.dataset.userAction;
  const username = button.dataset.username;
  userForm.elements.lookup_username.value = username;

  if (action === "view" || action === "edit") {
    document.getElementById("search-user-btn").click();
    return;
  }

  if (action === "delete") {
    document.getElementById("delete-user-btn").click();
  }
});

function loadStudentIntoForm(documento, intent = "view") {
  studentForm.elements.lookup_documento.value = documento;
  studentForm.elements.lookup_placa.value = "";
  document.getElementById("search-student-btn").click();

  if (intent === "edit") {
    studentForm.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

studentsTableWrap.addEventListener("click", (event) => {
  const button = event.target.closest("[data-student-action]");
  if (!button) return;

  const action = button.dataset.studentAction;
  const documento = button.dataset.documento;

  if (action === "view" || action === "edit") {
    loadStudentIntoForm(documento, action);
    return;
  }

  if (action === "delete") {
    studentForm.elements.lookup_documento.value = documento;
    document.getElementById("search-student-btn").click();
    setTimeout(() => {
      document.getElementById("delete-student-btn").click();
    }, 150);
  }
});

insideTableWrap.addEventListener("click", (event) => {
  const button = event.target.closest("[data-student-action]");
  if (!button) return;

  const action = button.dataset.studentAction;
  const documento = button.dataset.documento;

  if (action === "delete") {
    studentForm.elements.lookup_documento.value = documento;
    document.getElementById("search-student-btn").click();
    setTimeout(() => {
      document.getElementById("delete-student-btn").click();
    }, 150);
    return;
  }

  loadStudentIntoForm(documento, action);
});

document.getElementById("clear-output").addEventListener("click", () => {
  printResult("Respuesta", { ok: true, message: "Salida limpia" });
  showAlert("info", "Salida limpia", "Se limpio el panel de respuesta tecnica.");
});

ACTIVITY_EVENTS.forEach((eventName) => {
  window.addEventListener(eventName, registerActivity, { passive: true });
});

renderEmptyState(usersTableWrap, usersMeta, "Carga el listado de usuarios para ver acciones por fila.");
renderEmptyState(studentsTableWrap, studentsMeta, "Carga el listado de estudiantes para ver acciones por fila.");
renderEmptyState(insideTableWrap, insideMeta, "Consulta dentro del campus para ver el estado en una tabla.");
renderEmptyState(movementsTableWrap, movementsMeta, "Consulta movimientos para ver entradas y salidas recientes.");

updateStudentSearchMode("documento");
bootstrapSession();

