const output = document.getElementById("output");
const sessionRole = document.getElementById("session-role");
const sessionToken = document.getElementById("session-token");

let authToken = localStorage.getItem("access_token") || "";
let currentUser = JSON.parse(localStorage.getItem("auth_user") || "null");

function refreshSessionUI() {
  sessionRole.textContent = currentUser ? `${currentUser.username} / ${currentUser.role}` : "Sin iniciar";
  sessionToken.textContent = authToken ? "Disponible" : "No disponible";
}

function printResult(title, payload, isError = false) {
  output.classList.toggle("error", isError);
  output.textContent = `${title}\n\n${JSON.stringify(payload, null, 2)}`;
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
  const data = text ? JSON.parse(text) : {};

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
