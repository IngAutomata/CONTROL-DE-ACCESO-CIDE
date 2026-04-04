import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

const initialForm = {
  username: "",
  password: "",
  role: "CONSULTA",
};

export default function Admin() {
  const { apiRequest } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(initialForm);

  async function loadUsers() {
    const data = await apiRequest("/admin/usuarios");
    setUsuarios(data.usuarios || []);
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setError("");

      try {
        const data = await apiRequest("/admin/usuarios");

        if (!cancelled) {
          setUsuarios(data.usuarios || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [apiRequest]);

  async function handleCreateUser(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setStatus("");

    try {
      const data = await apiRequest("/admin/usuarios", {
        method: "POST",
        body: JSON.stringify(form),
      });

      setStatus(`Usuario ${data.usuario.username} creado correctamente.`);
      setForm(initialForm);
      await loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="page">
      <header className="page__header">
        <p className="eyebrow">Administracion</p>
        <h2>Herramientas exclusivas de ADMIN</h2>
        <p>
          Desde aqui puedes crear usuarios y revisar el estado general del acceso administrativo.
          La auditoria detallada se integrara cuando exista un endpoint estable en esta rama.
        </p>
      </header>

      {error ? <div className="form-error">{error}</div> : null}
      {status ? <div className="form-success">{status}</div> : null}

      <div className="cards-grid">
        <article className="info-card">
          <h3>Crear nuevo usuario</h3>
          <form className="stack-form" onSubmit={handleCreateUser}>
            <label>
              Username
              <input
                type="text"
                value={form.username}
                onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                placeholder="nuevo.usuario"
                required
              />
            </label>

            <label>
              Contrasena
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                placeholder="Segura123!"
                required
                minLength={8}
              />
            </label>

            <label>
              Rol
              <select
                value={form.role}
                onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
              >
                <option value="ADMIN">ADMIN</option>
                <option value="GUARDA">GUARDA</option>
                <option value="CONSULTA">CONSULTA</option>
              </select>
            </label>

            <button type="submit" disabled={loading}>
              {loading ? "Creando..." : "Crear usuario"}
            </button>
          </form>
        </article>

        <article className="info-card">
          <h3>Usuarios del sistema</h3>
          {usuarios.length === 0 ? (
            <div className="empty-state">No hay usuarios creados.</div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Usuario</th>
                    <th>Rol</th>
                    <th>Creado</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((user) => (
                    <tr key={user.id}>
                      <td>{user.id}</td>
                      <td>{user.username}</td>
                      <td>{user.role}</td>
                      <td>{user.created_at ? new Date(user.created_at).toLocaleString("es-CO") : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="info-card">
          <h3>Estado del modulo admin</h3>
          <div className="empty-state">
            Esta base React ya puede crear y listar usuarios. La parte de auditoria no se conecto
            aqui para evitar depender de endpoints que todavia no existen en la rama estable.
          </div>
        </article>
      </div>
    </section>
  );
}
