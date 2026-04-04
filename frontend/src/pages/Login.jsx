import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const { isAuthenticated, login, loading } = useAuth();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loginState, setLoginState] = useState("Portal listo para autenticacion.");
  const navigate = useNavigate();
  const location = useLocation();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const from = location.state?.from?.pathname || "/";

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoginState("Verificando credenciales institucionales...");

    try {
      const user = await login(form.username, form.password);
      setLoginState(`Acceso validado para ${user.username}. Cargando modulo ${user.role}...`);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
      setLoginState("No fue posible iniciar sesion. Revisa usuario y contraseña.");
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-backdrop"></div>
      <section className="auth-panel">
        <div className="auth-brand">
          <p className="eyebrow auth-eyebrow">Portal institucional</p>
          <h1 className="auth-wordmark">SIUC</h1>
          <p className="auth-submark">Sistema de Ingreso Universidad CIDE</p>
        </div>

        <div className="auth-card">
          <div className="auth-card-head">
            <p className="eyebrow">Acceso seguro</p>
            <h2>Iniciar sesion</h2>
            <p className="auth-copy">
              Ingresa con tu usuario del sistema. Una vez autenticado, la plataforma cargara automaticamente el flujo segun tu rol.
            </p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit} autoComplete="off">
            <label>
              Usuario
              <input
                type="text"
                name="username"
                value={form.username}
                onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                autoComplete="username"
                spellCheck="false"
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                autoComplete="current-password"
                required
              />
            </label>

            {error ? <div className="form-error">{error}</div> : null}
            <div className="auth-status">{loginState}</div>

            <button type="submit" disabled={loading}>
              {loading ? "Ingresando..." : "Iniciar sesion"}
            </button>
          </form>

          <div className="auth-divider"><span>portal interno</span></div>
          <div className="auth-help compact">
            <p className="login-note">
              Usa tus credenciales institucionales del sistema. El acceso visible dependera del rol autenticado.
            </p>
            <div className="login-role-grid">
              <article className="login-role-card">
                <span className="login-role-tag">ADMIN</span>
                <strong>Gestion total</strong>
                <p>Usuarios, estudiantes, monitoreo y control general del sistema.</p>
              </article>
              <article className="login-role-card">
                <span className="login-role-tag">GUARDA</span>
                <strong>Operacion de acceso</strong>
                <p>Registro por QR, primer ingreso y control de presencia en campus.</p>
              </article>
              <article className="login-role-card">
                <span className="login-role-tag">CONSULTA</span>
                <strong>Seguimiento</strong>
                <p>Vista de lectura para historial, estudiantes y estado del campus.</p>
              </article>
            </div>
          </div>
        </div>

        <p className="auth-footer-copy">Sistema de Ingreso Universidad CIDE</p>
      </section>
    </main>
  );
}
