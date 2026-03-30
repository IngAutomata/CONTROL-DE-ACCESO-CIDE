const output = document.getElementById("output");
const sessionRole = document.getElementById("session-role");
const sessionToken = document.getElementById("session-token");
const sessionState = document.getElementById("session-state");
const sessionTokenState = document.getElementById("session-token-state");
const sessionPermissions = document.getElementById("session-permissions");
const sessionCapabilities = document.getElementById("session-capabilities");
const sessionSummaryCopy = document.getElementById("session-summary-copy");
const roleBadges = document.getElementById("role-badges");
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
const dashboardRolePill = document.getElementById("dashboard-role-pill");
const dashboardCopy = document.getElementById("dashboard-copy");
const dashboardPriority = document.getElementById("dashboard-priority");
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
const sessionSummary = document.getElementById("session-summary");
const dashboardSummary = document.querySelector(".dashboard-summary");

let authToken = localStorage.getItem("access_token") || "";
let currentUser = JSON.parse(localStorage.getItem("auth_user") || "null");
const loginForm = document.getElementById("login-form");
const userForm = document.getElementById("user-form");
const studentForm = document.getElementById("student-form");
const documentForm = document.getElementById("document-form");
const movementForm = document.getElementById("movement-form");
const studentSubmitButton = studentForm.querySelector("button[type=\"submit\"]");
const searchStudentButton = document.getElementById("search-student-btn");
const updateStudentButton = document.getElementById("update-student-btn");
const deleteStudentButton = document.getElementById("delete-student-btn");
const searchUserButton = document.getElementById("search-user-btn");
const updateUserButton = document.getElementById("update-user-btn");
const deleteUserButton = document.getElementById("delete-user-btn");
const usersListButton = document.getElementById("users-btn");
let selectedUsername = "";
let selectedStudentDocumento = "";
let pendingConfirmAction = null;
let cachedUsers = [];
let cachedStudents = [];
let cachedInsideCampus = [];
let cachedMovements = [];
let activeStudentSearchMode = "documento";
let studentFormMode = "create";
const allRoleLabels = ["ADMIN", "GUARDA", "CONSULTA"];

const roleCapabilities = {
  ADMIN: {
    summary: "Gestion completa de usuarios, estudiantes, monitoreo y decisiones sensibles del sistema.",
    permissions: "Control total del sistema",
    active: ["ADMIN", "GUARDA", "CONSULTA"],
    sessionState: "Control total habilitado",
    tokenState: "JWT administrativo validado",
    dashboardLabel: "Modo ADMIN activo",
    dashboardPriority: "Prioriza revisar usuarios, monitoreo y consistencia general del sistema.",
    capabilityTags: ["Usuarios", "Estudiantes", "Monitoreo", "Acciones sensibles"],
    tone: "admin",
  },
  GUARDA: {
    summary: "Operacion de porteria enfocada en registro, verificacion rapida y monitoreo del campus.",
    permissions: "Operacion de porteria",
    active: ["GUARDA", "CONSULTA"],
    sessionState: "Porteria operativa",
    tokenState: "JWT operativo validado",
    dashboardLabel: "Modo GUARDA operativo",
    dashboardPriority: "Prioriza validar estudiantes, registrar movimientos y vigilar presencia en campus.",
    capabilityTags: ["Registro", "Verificacion", "Monitoreo"],
    tone: "guard",
  },
  CONSULTA: {
    summary: "Modo de consulta para revisar informacion y monitoreo sin modificar registros.",
    permissions: "Lectura operativa",
    active: ["CONSULTA"],
    sessionState: "Consulta en solo lectura",
    tokenState: "JWT de lectura validado",
    dashboardLabel: "Modo CONSULTA en lectura",
    dashboardPriority: "Prioriza revisar estados, historial y datos visibles sin intervenir registros.",
    capabilityTags: ["Consulta", "Historial", "Dentro del campus"],
    tone: "consulta",
  },
};

function isAdmin() {
  return currentUser?.role === "ADMIN";
}

function isGuard() {
  return currentUser?.role === "GUARDA";
}

function isConsulta() {
  return currentUser?.role === "CONSULTA";
}

function canManageUsers() {
  return isAdmin();
}

function canOperateStudents() {
  return isAdmin() || isGuard();
}

function canEditStudents() {
  return isAdmin() || isGuard();
}

function canDeleteStudents() {
  return isAdmin();
}

function canReadData() {
  return Boolean(authToken) && (isAdmin() || isGuard() || isConsulta());
}

function getStudentDataFields() {
  return [
    studentForm.elements.documento,
    studentForm.elements.qr_uid,
    studentForm.elements.nombre,
    studentForm.elements.carrera,
    studentForm.elements.placa,
    studentForm.elements.color,
    studentForm.elements.vigencia,
  ].filter(Boolean);
}

function setStudentFieldsDisabled(disabled) {
  getStudentDataFields().forEach((field) => {
    field.disabled = disabled;
  });

  studentForm.classList.toggle("form-readonly", disabled && Boolean(selectedStudentDocumento));
}

function setStudentFormMode(mode = "create") {
  studentFormMode = mode;

  if (mode === "edit") {
    setStudentFieldsDisabled(!canEditStudents());
  } else if (mode === "view") {
    setStudentFieldsDisabled(true);
  } else {
    setStudentFieldsDisabled(!canOperateStudents());
  }

  if (studentSubmitButton) {
    studentSubmitButton.textContent = mode === "edit" ? "Guardar cambios" : "Registrar primer ingreso";
    studentSubmitButton.disabled = mode === "view" || !canOperateStudents();
    studentSubmitButton.hidden = !canOperateStudents();
  }

  if (searchStudentButton) {
    searchStudentButton.hidden = !canOperateStudents();
    searchStudentButton.disabled = !canOperateStudents();
  }

  if (updateStudentButton) {
    updateStudentButton.hidden = !canEditStudents();
    updateStudentButton.disabled = !selectedStudentDocumento || !canEditStudents() || mode === "edit";
  }

  if (deleteStudentButton) {
    deleteStudentButton.hidden = !canDeleteStudents();
    deleteStudentButton.disabled = !selectedStudentDocumento || !canDeleteStudents();
  }
}

function clearUserFormState() {
  userForm.reset();
  selectedUsername = "";
}

function clearStudentFormState() {
  studentForm.reset();
  selectedStudentDocumento = "";
  setStudentFormMode("create");
  updateStudentSearchMode("documento");
}

function clearOperationalForms() {
  clearUserFormState();
  clearStudentFormState();
  documentForm.reset();
  movementForm.reset();
}

function refreshSessionUI() {
  const roleInfo = currentUser ? roleCapabilities[currentUser.role] : null;
  const tone = roleInfo?.tone || "guest";

  sessionRole.textContent = currentUser ? `${currentUser.username} / ${currentUser.role}` : "Sesion cerrada";
  sessionToken.textContent = authToken ? "Token presente" : "Sin token";
  sessionState.textContent = roleInfo ? roleInfo.sessionState : "Sin autenticar";
  sessionTokenState.textContent = roleInfo ? roleInfo.tokenState : "No validado";
  sessionPermissions.textContent = roleInfo ? roleInfo.permissions : "Inicia sesion para ver tus permisos";
  sessionSummaryCopy.textContent = roleInfo
    ? roleInfo.summary
    : "Sin sesion activa. Inicia con admin, guarda o consulta para cargar permisos y monitoreo.";
  sessionCapabilities.innerHTML = roleInfo
    ? roleInfo.capabilityTags.map((tag) => `<span class="capability-pill ${tone}">${tag}</span>`).join("")
    : '<span class="capability-pill muted">Sin permisos</span>';
  roleBadges.innerHTML = allRoleLabels.map((role) => `<span class="role-pill ${roleInfo && roleInfo.active.includes(role) ? `active ${tone}` : "muted"}">${role}</span>`).join("");

  sessionSummary.dataset.role = tone;
  dashboardSummary.dataset.role = tone;
  sessionState.className = `status-chip ${roleInfo ? tone : "muted"}`;
  sessionTokenState.className = `status-chip ${roleInfo ? "ok" : "muted"}`;

  syncRoleVisibility();
  refreshDashboard();
}

function syncRoleVisibility() {
  const role = currentUser?.role || "";
  const isAuthenticated = Boolean(authToken);
  const canOperate = canOperateStudents();
  const canRead = canReadData();

  document.querySelectorAll(".role-admin-only").forEach((panel) => {
    panel.hidden = role !== "ADMIN";
  });

  document.querySelectorAll(".role-admin-guard").forEach((panel) => {
    panel.hidden = !canOperate;
  });

  document.querySelectorAll(".role-read-only").forEach((panel) => {
    panel.hidden = !canRead;
  });

  document.querySelectorAll(".role-authenticated").forEach((panel) => {
    panel.hidden = !isAuthenticated;
  });

  if (searchUserButton) searchUserButton.hidden = !canManageUsers();
  if (updateUserButton) updateUserButton.hidden = !canManageUsers();
  if (deleteUserButton) deleteUserButton.hidden = !canManageUsers();
  if (usersListButton) usersListButton.hidden = !canManageUsers();

  setStudentFormMode(studentFormMode);

  document.querySelectorAll('[data-user-action="edit"], [data-user-action="delete"]').forEach((button) => {
    button.hidden = !canManageUsers();
  });

  document.querySelectorAll('[data-student-action="edit"]').forEach((button) => {
    button.hidden = !canEditStudents();
  });

  document.querySelectorAll('[data-student-action="delete"]').forEach((button) => {
    button.hidden = !canDeleteStudents();
  });

  const movementSubmit = movementForm.querySelector('button[type="submit"]');
  if (movementSubmit) {
    movementSubmit.hidden = !canOperate;
    movementSubmit.disabled = !canOperate;
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
      hint: "Usa admin, guarda o consulta en el bloque Login segun el acceso que necesites.",
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
  if (!studentNextStep) return;
  studentNextStep.textContent = message;
}

function formatMovementSummary(student) {
  if (!student) return "Sin movimiento reciente";
  const movement = student.tipo || student.ultimo_movimiento || "ENTRADA";
  const name = student.nombre || student.documento || "Registro";
  return `${movement}  -  ${name}`;
}

function refreshDashboard() {
  const roleInfo = currentUser ? roleCapabilities[currentUser.role] : null;
  const tone = roleInfo?.tone || "guest";

  metricUsers.textContent = String(cachedUsers.length || 0);
  metricStudents.textContent = String(cachedStudents.length || 0);
  metricInside.textContent = String(cachedInsideCampus.length || 0);
  metricLastMovement.textContent = formatMovementSummary(cachedMovements[0] || cachedInsideCampus[0]);
  dashboardRolePill.className = `role-pill ${roleInfo ? `active ${tone}` : "muted"}`;
  dashboardRolePill.textContent = currentUser?.role || "Sin rol";
  dashboardSummary.dataset.role = tone;

  if (!currentUser) {
    dashboardStatus.textContent = "Sin sesion validada";
    dashboardCopy.textContent = "Inicia sesion para cargar estudiantes, monitoreo y actividad reciente segun tu rol.";
    dashboardPriority.textContent = "Comienza con login y luego valida tu rol antes de operar la interfaz.";
    return;
  }

  dashboardStatus.textContent = roleInfo.dashboardLabel;

  if (currentUser.role === "ADMIN") {
    dashboardCopy.textContent = `Tienes ${cachedUsers.length} usuario(s), ${cachedStudents.length} estudiante(s), ${cachedInsideCampus.length} presencia(s) activas y un ultimo evento visible de ${metricLastMovement.textContent}.`;
    dashboardPriority.textContent = cachedUsers.length
      ? roleInfo.dashboardPriority
      : "Carga usuarios para completar la foto operativa y luego revisa monitoreo y actividad reciente.";
    return;
  }

  if (currentUser.role === "GUARDA") {
    dashboardCopy.textContent = `Hay ${cachedInsideCampus.length} estudiante(s) dentro del campus, ${cachedStudents.length} registro(s) visibles y el ultimo evento visible es ${metricLastMovement.textContent}.`;
    dashboardPriority.textContent = roleInfo.dashboardPriority;
    return;
  }

  dashboardCopy.textContent = `Consulta ${cachedStudents.length} estudiante(s), ${cachedInsideCampus.length} presencia(s) activas y el historial reciente sin modificar informacion.`;
  dashboardPriority.textContent = roleInfo.dashboardPriority;
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

function fillStudentForm(student, { mode = "view" } = {}) {
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
  setStudentFormMode(mode);
  setStudentNextStep(`Estudiante cargado. ${mode === "edit" ? "Puedes ajustar los datos y guardar cambios." : "Pulsa Editar estudiante para habilitar cambios."}`);
  flashStudentFormReady();
  refreshDashboard();
}

function resetUserSelection() {
  selectedUsername = "";
}

function resetStudentSelection() {
  selectedStudentDocumento = "";
  setStudentFormMode("create");
  setStudentNextStep("Busca por documento o placa. Si lo encontramos, cargaremos el formulario para editarlo o verificarlo.");
  refreshDashboard();
}

function resetCachedData() {
  cachedUsers = [];
  cachedStudents = [];
  cachedInsideCampus = [];
  cachedMovements = [];
}

function clearSessionState() {
  authToken = "";
  currentUser = null;
  localStorage.removeItem("access_token");
  localStorage.removeItem("auth_user");
  resetCachedData();
  clearOperationalForms();
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
                ${canManageUsers() ? `<button type="button" class="ghost mini-btn" data-user-action="edit" data-username="${escapeHtml(user.username)}">Editar</button>` : ""}
                ${canManageUsers() ? `<button type="button" class="danger mini-btn" data-user-action="delete" data-username="${escapeHtml(user.username)}">Eliminar</button>` : ""}
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
          <th>Documento</th>
          <th>Placa</th>
          <th>Fecha</th>
        </tr>
      </thead>
      <tbody>
        ${movements.map((movement) => `
          <tr>
            <td><span class="badge ${movement.tipo === "SALIDA" ? "exit" : "success"}">${escapeHtml(movement.tipo || "N/D")}</span></td>
            <td>${escapeHtml(movement.nombre || "N/D")}</td>
            <td>${escapeHtml(movement.documento || "N/D")}</td>
            <td>${escapeHtml(movement.placa || "N/D")}</td>
            <td>${escapeHtml(movement.fecha || movement.fecha_hora || "N/D")}</td>
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
                ${canEditStudents() ? `<button type="button" class="ghost mini-btn" data-student-action="edit" data-documento="${escapeHtml(student.documento)}">Editar</button>` : ""}
                ${canDeleteStudents() ? `<button type="button" class="danger mini-btn" data-student-action="delete" data-documento="${escapeHtml(student.documento)}">Eliminar</button>` : ""}
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
          <th>Documento</th>
          <th>Nombre</th>
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
            <td>${escapeHtml(student.documento)}</td>
            <td>${escapeHtml(student.nombre)}</td>
            <td>${escapeHtml(student.carrera)}</td>
            <td>${escapeHtml(student.placa || "N/D")}</td>
            <td><span class="badge success">${escapeHtml(student.ultimo_movimiento || "ENTRADA")}</span></td>
            <td>${escapeHtml(student.fecha_ultimo_movimiento || "N/D")}</td>
            <td>
              <div class="row-actions">
                <button type="button" class="ghost mini-btn" data-student-action="view" data-documento="${escapeHtml(student.documento)}">Ver</button>
                ${canEditStudents() ? `<button type="button" class="ghost mini-btn" data-student-action="edit" data-documento="${escapeHtml(student.documento)}">Editar</button>` : ""}
                ${canDeleteStudents() ? `<button type="button" class="danger mini-btn" data-student-action="delete" data-documento="${escapeHtml(student.documento)}">Eliminar</button>` : ""}
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

  const loaders = [];

  if (currentUser.role === "ADMIN") {
    loaders.push(refreshUsersTableData({ silent: true }));
  }

  if (["ADMIN", "GUARDA", "CONSULTA"].includes(currentUser.role)) {
    loaders.push(refreshStudentsTableData({ silent: true }));
    loaders.push(refreshInsideCampusTableData({ silent: true }));
    loaders.push(refreshMovementsTableData({ silent: true }));
  }

  await Promise.all(loaders);
}

async function bootstrapSession() {
  if (!authToken) {
    refreshSessionUI();
    return;
  }

  try {
    const profile = await apiFetch("/auth/me");
    currentUser = profile;
    localStorage.setItem("auth_user", JSON.stringify(currentUser));
    refreshSessionUI();
    await loadOperationalSnapshot();
  } catch (_) {
    clearSessionState();
    refreshSessionUI();
    renderEmptyState(usersTableWrap, usersMeta, "Carga el listado de usuarios para ver acciones por fila.");
    renderEmptyState(studentsTableWrap, studentsMeta, "Carga el listado de estudiantes para ver acciones por fila.");
    renderEmptyState(insideTableWrap, insideMeta, "Consulta dentro del campus para ver el estado en una tabla.");
    renderEmptyState(movementsTableWrap, movementsMeta, "Consulta movimientos para ver entradas y salidas recientes.");
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

loginForm.addEventListener("submit", async (event) => {
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
    localStorage.setItem("access_token", authToken);
    localStorage.setItem("auth_user", JSON.stringify(currentUser));
    refreshSessionUI();
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
  clearSessionState();
  loginForm.reset();
  refreshSessionUI();
  resetUserSelection();
  resetStudentSelection();
  renderEmptyState(usersTableWrap, usersMeta, "Carga el listado de usuarios para ver acciones por fila.");
  renderEmptyState(studentsTableWrap, studentsMeta, "Carga el listado de estudiantes para ver acciones por fila.");
  renderEmptyState(insideTableWrap, insideMeta, "Consulta dentro del campus para ver el estado en una tabla.");
  renderEmptyState(movementsTableWrap, movementsMeta, "Consulta movimientos para ver entradas y salidas recientes.");
  printResult("Sesion cerrada", { ok: true });
  showAlert("info", "Sesion cerrada", "La sesion actual se cerro correctamente.");
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
  if (!ensureAdminOrGuard(studentFormMode === "edit" ? "guardar cambios de estudiantes" : "registrar estudiantes")) return;

  const form = event.currentTarget;
  const formData = new FormData(form);
  const payload = buildStudentPayload(formData);

  if (!/^[A-Z]{3}\d{2}[A-Z]$/.test(payload.placa)) {
    printResult(
      studentFormMode === "edit" ? "Error guardando cambios" : "Error registrando estudiante",
      { error: "La placa debe tener formato ABC12D" },
      true
    );
    return;
  }

  if (studentFormMode === "edit") {
    const lookupDocumento = (studentForm.elements.lookup_documento.value || selectedStudentDocumento || "").trim();

    if (!lookupDocumento) {
      printResult("Error guardando cambios", { error: "Debes buscar primero un estudiante antes de editarlo" }, true);
      return;
    }

    await runWithConfirmation(
      "Se van a guardar cambios de este estudiante. ¿Deseas continuar?",
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

          fillStudentForm({ ...payload, ...data.estudiante, placa: payload.placa, color: payload.color }, { mode: "view" });
          printResult("Cambios guardados", data);
          await refreshStudentsTableData({ silent: true });
          await refreshInsideCampusTableData({ silent: true });
          await refreshMovementsTableData({ silent: true });
          showAlert("success", "Cambios guardados", `Se actualizo el estudiante ${payload.nombre}.`);
        } catch (error) {
          printResult("Error guardando cambios", error, true);
          showAlert("error", "No se pudo guardar el estudiante", normalizeErrorPayload(error).error || "Revisa los datos del estudiante.");
        }
      }
    );

    return;
  }

  try {
    const data = await apiFetch("/estudiantes/primer-ingreso", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    printResult("Estudiante registrado", data);
    fillStudentForm({ ...payload, ...data.estudiante, placa: payload.placa, color: payload.color }, { mode: "view" });
    await refreshStudentsTableData({ silent: true });
    await refreshInsideCampusTableData({ silent: true });
    await refreshMovementsTableData({ silent: true });
    showAlert("success", "Estudiante registrado", `Se registro el estudiante ${payload.nombre}.`);
  } catch (error) {
    printResult("Error registrando estudiante", error, true);
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

    fillStudentForm(data, { mode: "view" });
    printResult("Estudiante encontrado", data);
    showAlert("info", "Estudiante encontrado", `Se cargaron los datos de ${data.nombre}. Pulsa Editar estudiante para habilitar cambios.`);
  } catch (error) {
    printResult("Error buscando estudiante", error, true);
    resetStudentSelection();
    setStudentFormMode("create");

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

  const lookupDocumento = (studentForm.elements.lookup_documento.value || selectedStudentDocumento || "").trim();

  if (!lookupDocumento) {
    printResult("Edicion no disponible", { error: "Debes buscar primero un estudiante por documento o placa" }, true);
    return;
  }

  setStudentFormMode("edit");
  setStudentNextStep("Edicion habilitada. Ajusta los datos y usa Guardar cambios para confirmar.");
  studentForm.scrollIntoView({ behavior: "smooth", block: "start" });
  showAlert("info", "Edicion habilitada", "Ahora puedes modificar los campos del estudiante y guardar cambios.");
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
        clearStudentFormState();
        await refreshStudentsTableData({ silent: true });
        await refreshInsideCampusTableData({ silent: true });
        showAlert("success", "Estudiante eliminado", `Se elimino el estudiante ${lookupDocumento}.`);
      } catch (error) {
        printResult("Error eliminando estudiante", error, true);
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

async function loadStudentIntoForm(documento, intent = "view") {
  try {
    const data = await apiFetch(`/estudiantes/documento/${encodeURIComponent(documento)}`);
    const mode = intent === "edit" && canEditStudents() ? "edit" : "view";
    fillStudentForm(data, { mode });
    printResult("Estudiante encontrado", data);

    if (["view", "edit"].includes(intent)) {
      studentForm.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    showAlert("info", "Estudiante encontrado", `Se cargaron los datos de ${data.nombre}.`);
  } catch (error) {
    printResult("Error consultando estudiante", error, true);
    showAlert("error", "No se pudo cargar el estudiante", normalizeErrorPayload(error).error || "Verifica el documento.");
  }
}

studentsTableWrap.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-student-action]");
  if (!button) return;

  const action = button.dataset.studentAction;
  const documento = button.dataset.documento;

  if (action === "view" || action === "edit") {
    await loadStudentIntoForm(documento, action);
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

insideTableWrap.addEventListener("click", async (event) => {
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

  await loadStudentIntoForm(documento, action);
});

document.getElementById("clear-output").addEventListener("click", () => {
  printResult("Respuesta", { ok: true, message: "Salida limpia" });
  showAlert("info", "Salida limpia", "Se limpio el panel de respuesta tecnica.");
});

renderEmptyState(usersTableWrap, usersMeta, "Carga el listado de usuarios para ver acciones por fila.");
renderEmptyState(studentsTableWrap, studentsMeta, "Carga el listado de estudiantes para ver acciones por fila.");
renderEmptyState(insideTableWrap, insideMeta, "Consulta dentro del campus para ver el estado en una tabla.");
renderEmptyState(movementsTableWrap, movementsMeta, "Consulta movimientos para ver entradas y salidas recientes.");

updateStudentSearchMode("documento");
bootstrapSession();


















