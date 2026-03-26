const output = document.getElementById("output");
const sessionRole = document.getElementById("session-role");
const sessionToken = document.getElementById("session-token");
const historyPanel = document.getElementById("history-panel");
const historyTable = document.getElementById("history-table");
const historyBody = document.getElementById("history-body");
const historyEmpty = document.getElementById("history-empty");
const historyButton = document.getElementById("history-btn");
const historyRefreshButton = document.getElementById("history-refresh-btn");

let authToken = localStorage.getItem("access_token") || "";
let currentUser = JSON.parse(localStorage.getItem("auth_user") || "null");
let historyAutoRefreshId = null;

function refreshSessionUI() {
  sessionRole.textContent = currentUser ? `${currentUser.username} / ${currentUser.role}` : "Sin iniciar";
  sessionToken.textContent = authToken ? "Disponible" : "No disponible";
  historyButton.classList.toggle("hidden", currentUser?.role !== "ADMIN");
}

function printResult(title, payload, isError = false) {
  output.classList.toggle("error", isError);
  output.textContent = `${title}\n\n${JSON.stringify(payload, null, 2)}`;
}

function formatDateTime(value) {
  if (!value) {
    return { fecha: "-", hora: "-" };
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return { fecha: value, hora: "-" };
  }

  return {
    fecha: date.toLocaleDateString("es-CO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }),
    hora: date.toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
  };
}

function hideHistoryPanel() {
  historyPanel.classList.add("hidden");
  stopHistoryAutoRefresh();
}

function isHistoryVisible() {
  return !historyPanel.classList.contains("hidden");
}

function stopHistoryAutoRefresh() {
  if (historyAutoRefreshId) {
    window.clearInterval(historyAutoRefreshId);
    historyAutoRefreshId = null;
  }
}

function startHistoryAutoRefresh() {
  stopHistoryAutoRefresh();

  historyAutoRefreshId = window.setInterval(async () => {
    if (!isHistoryVisible() || currentUser?.role !== "ADMIN") {
      stopHistoryAutoRefresh();
      return;
    }

    try {
      const data = await apiFetch("/admin/auditoria");
      renderHistory(data.auditoria || []);
    } catch (_) {
      // Si falla una recarga automatica no interrumpimos la pantalla.
    }
  }, 5000);
}

function renderHistory(registros = []) {
  historyBody.innerHTML = "";

  if (!registros.length) {
    historyEmpty.classList.remove("hidden");
    historyTable.classList.add("hidden");
    historyPanel.classList.remove("hidden");
    return;
  }

  const rows = registros.map((registro) => {
    const { fecha, hora } = formatDateTime(registro.created_at);
    const tipo = String(registro.tipo_movimiento || "").toUpperCase();
    const tipoClass = tipo.includes("ENTRADA") ? "entrada" : tipo.includes("SALIDA") ? "salida" : "";
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${fecha}</td>
      <td>${hora}</td>
      <td><span class="history-type ${tipoClass}">${tipo || "-"}</span></td>
      <td>${registro.tabla || "-"}</td>
      <td>${registro.registro_id ?? "-"}</td>
      <td>${registro.actor_username || "Sistema"}</td>
      <td>${registro.descripcion || "-"}</td>
    `;

    return tr;
  });

  historyBody.append(...rows);
  historyEmpty.classList.add("hidden");
  historyTable.classList.remove("hidden");
  historyPanel.classList.remove("hidden");
  startHistoryAutoRefresh();
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

async function apiFetch(url, options = {}) {
  const method = options.method || "GET";
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(url, {
    ...options,
    cache: options.cache || "no-store",
    headers,
  });

  const text = await response.text();
  let data;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      data = { message: text, parseError: parseError.message };
    }
  } else {
    data = {};
  }

  console.log(`[api] ${method} ${url} -> ${response.status} ${response.statusText}`, data);

  if (!response.ok) {
    throw { status: response.status, data };
  }

  return data;
}

async function loadHistory() {
  if (!requireAuth("consultar el historico de auditoria")) return;
  if (currentUser?.role !== "ADMIN") {
    hideHistoryPanel();
    printResult("Acceso denegado", { error: "Solo ADMIN puede visualizar historicos." }, true);
    return;
  }

  try {
    const data = await apiFetch("/admin/auditoria");
    renderHistory(data.auditoria || []);
    printResult("Historico de auditoria", data);
  } catch (error) {
    hideHistoryPanel();
    printResult("Error consultando historicos", error, true);
  }
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
  hideHistoryPanel();
  printResult("Sesion cerrada", { ok: true });
});

document.getElementById("user-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requireAuth("crear usuarios")) return;

  const formData = new FormData(event.currentTarget);

  try {
    const data = await apiFetch("/admin/usuarios", {
      method: "POST",
      body: JSON.stringify({
        username: formData.get("username"),
        password: formData.get("password"),
        role: formData.get("role"),
      }),
    });

    printResult("Usuario creado", data);
    event.currentTarget.reset();
  } catch (error) {
    printResult("Error creando usuario", error, true);
  }
});

document.getElementById("users-btn").addEventListener("click", async () => {
  if (!requireAuth("listar usuarios")) return;

  try {
    const data = await apiFetch("/admin/usuarios");
    printResult("Usuarios del sistema", data);
  } catch (error) {
    printResult("Error listando usuarios", error, true);
  }
});

document.getElementById("student-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requireAuth("registrar estudiantes")) return;

  const formData = new FormData(event.currentTarget);

  try {
    const data = await apiFetch("/estudiantes/primer-ingreso", {
      method: "POST",
      body: JSON.stringify({
        documento: formData.get("documento"),
        qr_uid: formData.get("qr_uid"),
        nombre: formData.get("nombre"),
        carrera: formData.get("carrera"),
        placa: formData.get("placa"),
        color: formData.get("color"),
        vigencia: formData.get("vigencia") === "on",
      }),
    });

    printResult("Estudiante registrado", data);
    event.currentTarget.reset();
  } catch (error) {
    printResult("Error registrando estudiante", error, true);
  }
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

    if (currentUser?.role === "ADMIN" && isHistoryVisible()) {
      await loadHistory();
    }
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

document.getElementById("history-btn").addEventListener("click", async () => {
  await loadHistory();
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

document.getElementById("history-close-btn").addEventListener("click", () => {
  hideHistoryPanel();
});

historyRefreshButton.addEventListener("click", async () => {
  await loadHistory();
});

refreshSessionUI();
hideHistoryPanel();
