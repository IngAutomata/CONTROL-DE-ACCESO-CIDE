const output = document.getElementById("output");
const sessionRole = document.getElementById("session-role");
const sessionToken = document.getElementById("session-token");
const confirmModal = document.getElementById("confirm-modal");
const modalMessage = document.getElementById("modal-message");
const modalConfirmBtn = document.getElementById("modal-confirm-btn");
const modalCancelBtn = document.getElementById("modal-cancel-btn");

let authToken = localStorage.getItem("access_token") || "";
let currentUser = JSON.parse(localStorage.getItem("auth_user") || "null");
const userForm = document.getElementById("user-form");
const studentForm = document.getElementById("student-form");
let selectedUsername = "";
let selectedStudentDocumento = "";
let pendingConfirmAction = null;

function refreshSessionUI() {
  sessionRole.textContent = currentUser ? `${currentUser.username} / ${currentUser.role}` : "Sin iniciar";
  sessionToken.textContent = authToken ? "Disponible" : "No disponible";
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
}

function resetUserSelection() {
  selectedUsername = "";
}

function resetStudentSelection() {
  selectedStudentDocumento = "";
}

function openConfirmModal(message, action) {
  pendingConfirmAction = action;
  modalMessage.textContent = message;
  confirmModal.classList.remove("hidden");
  confirmModal.setAttribute("aria-hidden", "false");
  modalConfirmBtn.focus();
}

function closeConfirmModal() {
  pendingConfirmAction = null;
  confirmModal.classList.add("hidden");
  confirmModal.setAttribute("aria-hidden", "true");
}

async function runWithConfirmation(message, action) {
  return new Promise((resolve) => {
    openConfirmModal(message, async () => {
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
    localStorage.setItem("access_token", authToken);
    localStorage.setItem("auth_user", JSON.stringify(currentUser));
    refreshSessionUI();
    printResult("Login exitoso", data);
  } catch (error) {
    printResult("Error en login", error, true);
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
  authToken = "";
  currentUser = null;
  localStorage.removeItem("access_token");
  localStorage.removeItem("auth_user");
  refreshSessionUI();
  resetUserSelection();
  resetStudentSelection();
  printResult("Sesion cerrada", { ok: true });
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
  } catch (error) {
    printResult("Error creando usuario", error, true);
  }
});

document.getElementById("users-btn").addEventListener("click", async () => {
  if (!ensureAdmin("listar usuarios")) return;

  try {
    const data = await apiFetch("/admin/usuarios");
    printResult("Usuarios del sistema", data);
  } catch (error) {
    printResult("Error listando usuarios", error, true);
  }
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
  } catch (error) {
    printResult("Error buscando usuario", error, true);
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
    `Vas a actualizar el usuario "${lookupUsername}". Verifica role y password antes de continuar.`,
    async () => {
      try {
        const data = await apiFetch(`/admin/usuarios/username/${encodeURIComponent(lookupUsername)}`, {
          method: "PUT",
          body: JSON.stringify(buildUserPayload(formData)),
        });

        fillUserForm(data.usuario);
        printResult("Usuario actualizado", data);
      } catch (error) {
        printResult("Error editando usuario", error, true);
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
    `Vas a eliminar el usuario "${lookupUsername}". Esta accion no se puede deshacer.`,
    async () => {
      try {
        const data = await apiFetch(`/admin/usuarios/username/${encodeURIComponent(lookupUsername)}`, {
          method: "DELETE",
        });

        printResult("Usuario eliminado", data);
        userForm.reset();
        resetUserSelection();
      } catch (error) {
        printResult("Error eliminando usuario", error, true);
      }
    }
  );
});

document.getElementById("student-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requireAuth("registrar estudiantes")) return;

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
  } catch (error) {
    printResult("Error registrando estudiante", error, true);
  }
});

document.getElementById("search-student-btn").addEventListener("click", async () => {
  if (!ensureAdmin("buscar estudiantes")) return;

  const lookupDocumento = (studentForm.elements.lookup_documento.value || studentForm.elements.documento.value || "").trim();
  const lookupPlaca = normalizePlate(studentForm.elements.lookup_placa.value || studentForm.elements.placa.value || "");

  if (!lookupDocumento && !lookupPlaca) {
    printResult("Error buscando estudiante", { error: "Debes indicar documento o placa" }, true);
    return;
  }

  try {
    const data = lookupDocumento
      ? await apiFetch(`/admin/estudiantes/documento/${encodeURIComponent(lookupDocumento)}`)
      : await apiFetch(`/admin/estudiantes/placa/${encodeURIComponent(lookupPlaca)}`);

    fillStudentForm(data);
    printResult("Estudiante encontrado", data);
  } catch (error) {
    printResult("Error buscando estudiante", error, true);
  }
});

document.getElementById("update-student-btn").addEventListener("click", async () => {
  if (!ensureAdmin("editar estudiantes")) return;

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
    `Vas a actualizar el estudiante con documento "${lookupDocumento}". Confirma que los datos cargados son correctos.`,
    async () => {
      try {
        const data = await apiFetch(`/admin/estudiantes/documento/${encodeURIComponent(lookupDocumento)}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });

        fillStudentForm({ ...payload, ...data.estudiante, placa: payload.placa, color: payload.color });
        printResult("Estudiante actualizado", data);
      } catch (error) {
        printResult("Error editando estudiante", error, true);
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
    `Vas a eliminar el estudiante con documento "${lookupDocumento}". Esta accion no se puede deshacer.`,
    async () => {
      try {
        const data = await apiFetch(`/admin/estudiantes/documento/${encodeURIComponent(lookupDocumento)}`, {
          method: "DELETE",
        });

        printResult("Estudiante eliminado", data);
        studentForm.reset();
        resetStudentSelection();
      } catch (error) {
        printResult("Error eliminando estudiante", error, true);
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

document.getElementById("document-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requireAuth("consultar estudiantes")) return;

  const formData = new FormData(event.currentTarget);

  try {
    const data = await apiFetch(`/estudiantes/documento/${encodeURIComponent(formData.get("documento"))}`);
    printResult("Estudiante encontrado", data);
  } catch (error) {
    printResult("Error consultando estudiante", error, true);
  }
});

document.getElementById("movement-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requireAuth("registrar movimientos")) return;

  const formData = new FormData(event.currentTarget);

  try {
    const data = await apiFetch("/movimientos/registrar", {
      method: "POST",
      body: JSON.stringify({
        qr_uid: formData.get("qr_input"),
      }),
    });
    printResult("Movimiento registrado", data);
  } catch (error) {
    printResult("Error registrando movimiento", error, true);
  }
});

document.getElementById("inside-btn").addEventListener("click", async () => {
  if (!requireAuth("consultar estudiantes dentro del campus")) return;

  try {
    const data = await apiFetch("/movimientos/dentro-campus");
    printResult("Estudiantes dentro del campus", data);
  } catch (error) {
    printResult("Error consultando dentro del campus", error, true);
  }
});

document.getElementById("students-btn").addEventListener("click", async () => {
  if (!requireAuth("listar estudiantes")) return;

  try {
    const data = await apiFetch("/estudiantes");
    printResult("Listado de estudiantes", data);
  } catch (error) {
    printResult("Error listando estudiantes", error, true);
  }
});

document.getElementById("clear-output").addEventListener("click", () => {
  printResult("Respuesta", { ok: true, message: "Salida limpia" });
});

refreshSessionUI();
