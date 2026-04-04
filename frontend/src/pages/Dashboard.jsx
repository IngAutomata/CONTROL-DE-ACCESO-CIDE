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
    { title: "Usuario activo", value: user?.username || "-", detail: role || "Sin rol", tone: "blue" },
    { title: "Rol operativo", value: role || "-", detail: "Perfil autenticado", tone: "green" },
    { title: "Identificador", value: profile?.id || user?.id || "-", detail: "Control de acceso", tone: "orange" },
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
