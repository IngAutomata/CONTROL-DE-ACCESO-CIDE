import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

const summaryByRole = {
  ADMIN: {
    title: "Control total del sistema",
    description: "Gestiona usuarios, revisa historicos y monitorea la operacion completa del campus.",
    actions: [
      "Administrar usuarios del sistema",
      "Consultar reportes y auditoria",
      "Ver movimientos y estudiantes dentro del campus",
    ],
  },
  GUARDA: {
    title: "Operacion de acceso",
    description: "Registra entradas y salidas, valida estudiantes y supervisa quienes estan dentro del campus.",
    actions: [
      "Registrar entradas y salidas por QR",
      "Consultar estudiantes dentro del campus",
      "Registrar primer ingreso de estudiantes",
    ],
  },
  CONSULTA: {
    title: "Consulta controlada",
    description: "Accede solo a informacion de lectura para seguimiento y reportes.",
    actions: [
      "Consultar informacion general",
      "Visualizar resumen de acceso",
    ],
  },
};

export default function Dashboard() {
  const { role, user, apiRequest } = useAuth();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const summary = useMemo(() => summaryByRole[role] || summaryByRole.CONSULTA, [role]);
  const metricCards = useMemo(() => ([
    { title: "Sesion", value: user?.username || "-", detail: role || "Sin rol", tone: "blue" },
    { title: "Perfil", value: role || "-", detail: "Acceso autenticado", tone: "green" },
    { title: "Identificador", value: profile?.id || user?.id || "-", detail: "Registro interno", tone: "orange" },
    { title: "Estado", value: "ACTIVO", detail: "Sesion validada", tone: "accent" },
  ]), [profile?.id, role, user?.id, user?.username]);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const data = await apiRequest("/auth/me");

        if (!cancelled) {
          setProfile(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [apiRequest]);

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
            Panel operativo del <strong>SIU</strong> para control de acceso, validacion y seguimiento institucional.
          </p>
          <div className="welcome-panel__meta">
            <span>{role || "Sin rol"}</span>
            <span>{user?.username || "-"}</span>
            <span>{profile?.id ? `ID ${profile.id}` : "Sin ID"}</span>
          </div>
        </div>
        <div className="welcome-panel__score">
          <div className="welcome-ring">
            <span>100%</span>
          </div>
          <p>Integridad operativa</p>
        </div>
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
          <h3>Sesion actual</h3>
          <dl className="info-list">
            <div>
              <dt>Usuario</dt>
              <dd>{user?.username || "-"}</dd>
            </div>
            <div>
              <dt>Rol</dt>
              <dd>{role || "-"}</dd>
            </div>
            <div>
              <dt>ID</dt>
              <dd>{profile?.id || user?.id || "-"}</dd>
            </div>
          </dl>
        </article>

        <article className="info-card">
          <h3>Acciones habilitadas</h3>
          <ul className="feature-list">
            {summary.actions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        </article>
      </div>

      {error ? <div className="form-error">{error}</div> : null}
    </section>
  );
}
