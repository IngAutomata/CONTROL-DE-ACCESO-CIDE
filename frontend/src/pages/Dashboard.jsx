import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

function formatDate(value) {
  if (!value) return "Sin datos";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${date.toLocaleDateString("es-CO")} ${date.toLocaleTimeString("es-CO")}`;
}

function getRoleSnapshot(role) {
  if (role === "ADMIN") {
    return {
      label: "Cobertura completa",
      detail: "Usuarios, estudiantes, movimientos y monitoreo.",
    };
  }

  if (role === "GUARDA") {
    return {
      label: "Turno operativo",
      detail: "Control de acceso, presencia activa y validaci\u00f3n de estudiantes.",
    };
  }

  return {
    label: "Lectura supervisada",
    detail: "Consulta de estado del campus e historial reciente.",
  };
}

function buildSummary(role, counts) {
  if (role === "ADMIN") {
    return {
      title: "Control total del sistema",
      description: "Gestiona usuarios, revisa hist\u00f3ricos y monitorea la operaci\u00f3n completa del campus.",
      priority: counts.users > 0
        ? "Revisa presencia activa, valida el \u00faltimo evento y mant\u00e9n actualizada la base operativa."
        : "Carga primero los usuarios del sistema para completar el panorama administrativo.",
      actions: [
        "Validar usuarios del sistema",
        "Revisar monitoreo del campus",
        "Supervisar el historial reciente",
      ],
    };
  }

  if (role === "GUARDA") {
    return {
      title: "Operaci\u00f3n de acceso",
      description: "Registra entradas y salidas, valida estudiantes y supervisa qui\u00e9nes est\u00e1n dentro del campus.",
      priority: counts.inside > 0
        ? "Prioriza el control de presencia y mant\u00e9n visible el \u00faltimo evento procesado."
        : "Comienza con un escaneo QR o verifica estudiantes antes de iniciar turno.",
      actions: [
        "Escanear QR para acceso",
        "Consultar estudiantes dentro del campus",
        "Buscar estudiantes por documento o placa",
      ],
    };
  }

  return {
    title: "Consulta controlada",
    description: "Accede a informaci\u00f3n de lectura para seguimiento y reportes sin modificar registros.",
    priority: counts.movements > 0
      ? "Usa el historial y el estado del campus para seguimiento sin intervenir la operaci\u00f3n."
      : "Carga informaci\u00f3n de movimientos para tener contexto operativo.",
    actions: [
      "Ver estudiantes dentro del campus",
      "Consultar historial reciente",
      "Verificar informaci\u00f3n general",
    ],
  };
}

export default function Dashboard() {
  const { role, user, apiRequest } = useAuth();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [loadingData, setLoadingData] = useState(true);
  const [counts, setCounts] = useState({
    students: 0,
    inside: 0,
    movements: 0,
    users: 0,
  });
  const [latestMovement, setLatestMovement] = useState(null);
  const [latestInside, setLatestInside] = useState(null);

  const summary = useMemo(() => buildSummary(role, counts), [counts, role]);
  const roleSnapshot = useMemo(() => getRoleSnapshot(role), [role]);
  const dashboardStatus = useMemo(() => {
    if (loadingData) {
      return {
        tone: "blue",
        label: "Actualizando tablero",
        detail: "Sincronizando estudiantes, movimientos y presencia activa.",
      };
    }

    if (error) {
      return {
        tone: "danger",
        label: "Revisi\u00f3n requerida",
        detail: "No fue posible cargar el tablero completo. Revisa conectividad o permisos.",
      };
    }

    if (latestMovement) {
      return {
        tone: latestMovement.tipo === "ENTRADA" ? "green" : "orange",
        label: `${latestMovement.tipo} visible`,
        detail: `${latestMovement.nombre} - ${formatDate(latestMovement.fecha_hora)}`,
      };
    }

    return {
      tone: "neutral",
      label: "Sin actividad reciente",
      detail: "El tablero est\u00e1 listo, pero a\u00fan no hay eventos visibles en esta sesi\u00f3n.",
    };
  }, [error, latestMovement, loadingData]);

  const metricCards = useMemo(() => ([
    {
      title: "Dentro del campus",
      value: counts.inside,
      detail: latestInside ? `\u00daltimo ingreso visible: ${latestInside.nombre}` : "Sin presencia activa visible",
      tone: "green",
    },
    {
      title: "Estudiantes",
      value: counts.students,
      detail: "Base operativa disponible",
      tone: "blue",
    },
    {
      title: role === "ADMIN" ? "Usuarios" : "Movimientos",
      value: role === "ADMIN" ? counts.users : counts.movements,
      detail: role === "ADMIN" ? "Cuentas del sistema" : "Eventos registrados",
      tone: "orange",
    },
    {
      title: "\u00daltimo evento",
      value: latestMovement?.tipo || "Sin datos",
      detail: latestMovement ? `${latestMovement.nombre} - ${formatDate(latestMovement.fecha_hora)}` : "A\u00fan no hay actividad reciente",
      tone: "accent",
    },
  ]), [counts.inside, counts.movements, counts.students, counts.users, latestInside, latestMovement, role]);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard({ silent = false } = {}) {
      if (!silent) {
        setLoadingData(true);
        setError("");
      }
      try {
        const requests = [
          apiRequest("/auth/me"),
          apiRequest("/estudiantes"),
          apiRequest("/movimientos/dentro-campus"),
          apiRequest("/movimientos"),
        ];

        if (role === "ADMIN") {
          requests.push(apiRequest("/admin/usuarios"));
        }

        const [profileData, studentsData, insideData, movementsData, usersData] = await Promise.all(requests);

        if (cancelled) return;

        setProfile(profileData);
        setCounts({
          students: studentsData.count || studentsData.estudiantes?.length || 0,
          inside: insideData.count || insideData.estudiantes?.length || 0,
          movements: movementsData.count || movementsData.movimientos?.length || 0,
          users: role === "ADMIN" ? (usersData?.count || usersData?.usuarios?.length || 0) : 0,
        });
        setLatestMovement((movementsData.movimientos || [])[0] || null);
        setLatestInside((insideData.estudiantes || [])[0] || null);
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled && !silent) {
          setLoadingData(false);
        }
      }
    }

    loadDashboard();

    const interval = window.setInterval(() => {
      loadDashboard({ silent: true }).catch(() => null);
    }, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [apiRequest, role]);

  return (
    <section className="page">
      <header className="page__header">
        <p className="eyebrow">Dashboard</p>
        <h2>Bienvenido, {user?.username || "usuario"}.</h2>
        <p>{summary.description}</p>
      </header>

      <section className="welcome-panel">
        <div className="welcome-panel__main">
          <h3>Portal principal</h3>
          <p className="welcome-panel__headline">
            {"Panel operativo del "}<strong>SIUC</strong>{" para control de acceso, validaci\u00f3n y seguimiento institucional."}
          </p>
          <div className="welcome-panel__meta">
            <span>{role || "Sin rol"}</span>
            <span>{user?.username || "-"}</span>
            <span>{profile?.id ? `ID ${profile.id}` : "Sin ID"}</span>
          </div>
        </div>
        <div className="welcome-panel__score">
          <div className="welcome-ring">
            <span>{loadingData ? "..." : `${counts.inside}`}</span>
          </div>
          <p>Presencia activa</p>
        </div>
      </section>

      <section className="dashboard-strip">
        <article className={`dashboard-strip__card dashboard-strip__card--${dashboardStatus.tone}`}>
          <span className="dashboard-strip__label">Estado del tablero</span>
          <strong>{dashboardStatus.label}</strong>
          <p>{dashboardStatus.detail}</p>
        </article>
        <article className="dashboard-strip__card dashboard-strip__card--neutral">
          <span className="dashboard-strip__label">Cobertura del rol</span>
          <strong>{roleSnapshot.label}</strong>
          <p>{roleSnapshot.detail}</p>
        </article>
      </section>

      <div className="stats-grid">
        {metricCards.map((card) => (
          <article key={card.title} className={`stat-card stat-card--${card.tone}`}>
            <div className="stat-card__icon" aria-hidden="true"></div>
            <h3>{card.title}</h3>
            <strong>{card.value}</strong>
            <p>{card.detail}</p>
          </article>
        ))}
      </div>

      <div className="cards-grid">
        <article className="info-card">
          <p className="eyebrow">Resumen operativo</p>
          <h3>{summary.title}</h3>
          <p className="movement-copy">{summary.description}</p>
          <div className="dashboard-callout">
            <span className="dashboard-callout__label">Prioridad sugerida</span>
            <strong>{summary.priority}</strong>
          </div>
        </article>

        <article className="info-card">
          <p className="eyebrow">{"Siguiente acci\u00f3n recomendada"}</p>
          <h3>Ruta sugerida para este rol</h3>
          <ul className="feature-list">
            {summary.actions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        </article>
      </div>

      <div className="cards-grid">
        <article className="info-card">
          <p className="eyebrow">{"\u00daltimo movimiento visible"}</p>
          <h3>Actividad reciente del sistema</h3>
          {latestMovement ? (
            <div className="scan-result">
              <span className={`movement-pill ${latestMovement.tipo === "ENTRADA" ? "entry" : "exit"}`}>
                {latestMovement.tipo}
              </span>
              <strong className="scan-result__name">{latestMovement.nombre}</strong>
              <div className="scan-result__meta">
                <span>Documento: {latestMovement.documento}</span>
                <span>Hora: {formatDate(latestMovement.fecha_hora)}</span>
                <span>Responsable: {latestMovement.actor_username || "Sin responsable"}</span>
                <span>Rol actual: {role || "Sin rol"}</span>
              </div>
            </div>
          ) : (
            <div className="empty-state">{"A\u00fan no hay movimientos visibles para alimentar el tablero."}</div>
          )}
        </article>

        <article className="info-card">
          <p className="eyebrow">Presencia activa</p>
          <h3>Estado actual del campus</h3>
          {latestInside ? (
            <div className="scan-result">
              <span className="movement-pill entry">En campus</span>
              <strong className="scan-result__name">{latestInside.nombre}</strong>
              <div className="scan-result__meta">
                <span>Documento: {latestInside.documento}</span>
                <span>Placa: {latestInside.placa || "-"}</span>
                <span>{`\u00daltimo ingreso: ${formatDate(latestInside.fecha_ultimo_movimiento)}`}</span>
                <span>Responsable: {latestInside.actor_username || "Sin responsable"}</span>
              </div>
            </div>
          ) : (
            <div className="empty-state">No hay estudiantes visibles dentro del campus en este momento.</div>
          )}
        </article>
      </div>

      {error ? <div className="form-error">{error}</div> : null}
    </section>
  );
}
