import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

const initialForm = {
  username: "",
  password: "",
  role: "CONSULTA",
};

export default function Admin() {
  const { apiRequest } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [estudiantes, setEstudiantes] = useState([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [studentDeleteTarget, setStudentDeleteTarget] = useState(null);
  const [studentFilter, setStudentFilter] = useState("");

  async function loadUsers() {
    const data = await apiRequest("/admin/usuarios");
    setUsuarios(data.usuarios || []);
  }

  async function loadStudents() {
    const data = await apiRequest("/estudiantes");
    setEstudiantes(data.estudiantes || []);
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setError("");

      try {
        const [usersData, studentsData] = await Promise.all([
          apiRequest("/admin/usuarios"),
          apiRequest("/estudiantes"),
        ]);

        if (!cancelled) {
          setUsuarios(usersData.usuarios || []);
          setEstudiantes(studentsData.estudiantes || []);
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

  async function handleConfirmDeleteStudent() {
    if (!studentDeleteTarget) return;

    setLoading(true);
    setError("");
    setStatus("");

    try {
      const data = await apiRequest(`/admin/estudiantes/documento/${encodeURIComponent(studentDeleteTarget.documento)}`, {
        method: "DELETE",
      });

      setStatus(`Estudiante ${data.estudiante.nombre} eliminado correctamente.`);
      setStudentDeleteTarget(null);
      await loadStudents();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const filteredStudents = useMemo(() => {
    const term = studentFilter.trim().toLowerCase();
    if (!term) return estudiantes;

    return estudiantes.filter((student) => {
      const fields = [
        student.documento,
        student.nombre,
        student.placa,
        student.qr_uid,
        student.created_by_username,
        student.updated_by_username,
      ];

      return fields.some((value) => String(value || "").toLowerCase().includes(term));
    });
  }, [estudiantes, studentFilter]);

  return (
    <section className="page">
      <header className="page__header">
        <p className="eyebrow">Administración</p>
        <h2>Herramientas exclusivas de ADMIN</h2>
        <p>
          Desde aquí puedes crear usuarios, revisar estudiantes y gestionar la operación administrativa del sistema.
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
              Contraseña
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
      </div>

      <section className="table-panel">
        <div className="table-panel__header admin-table-header">
          <div>
            <p className="eyebrow">Gestión de estudiantes</p>
            <h3>Estudiantes del sistema</h3>
          </div>
          <div className="admin-table-tools">
            <input
              type="text"
              value={studentFilter}
              onChange={(event) => setStudentFilter(event.target.value)}
              placeholder="Filtrar por documento, nombre, placa, QR o responsable"
            />
            <span className="table-count">{filteredStudents.length} visible(s)</span>
          </div>
        </div>

        {estudiantes.length === 0 ? (
          <div className="empty-state">No hay estudiantes registrados.</div>
        ) : filteredStudents.length === 0 ? (
          <div className="empty-state">No se encontraron estudiantes con ese filtro.</div>
        ) : (
          <div className="table-wrap table-wrap--scrollable table-wrap--panel">
            <table className="data-table admin-students-table">
              <thead>
                <tr>
                  <th>Documento</th>
                  <th>Nombre</th>
                  <th>QR</th>
                  <th>Placa</th>
                  <th>Celular</th>
                  <th>Vigencia</th>
                  <th>Creado por</th>
                  <th>Actualizado por</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student.estudiante_id}>
                    <td>{student.documento}</td>
                    <td>{student.nombre}</td>
                    <td>{student.qr_uid || "-"}</td>
                    <td>{student.placa || "-"}</td>
                    <td>{student.celular || "-"}</td>
                    <td>{student.vigencia ? "Vigente" : "No vigente"}</td>
                    <td>{student.created_by_username || "Sin responsable"}</td>
                    <td>{student.updated_by_username || "Sin responsable"}</td>
                    <td>
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => setStudentDeleteTarget(student)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <article className="info-card">
        <h3>Estado del módulo admin</h3>
        <div className="empty-state">
          Aquí ADMIN ya puede crear usuarios, revisar estudiantes y eliminar estudiantes con confirmación.
        </div>
      </article>

      {studentDeleteTarget ? (
        <div className="modal" aria-hidden="false">
          <div className="modal-backdrop" onClick={() => setStudentDeleteTarget(null)} />
          <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="delete-student-title">
            <p className="eyebrow">Confirmación requerida</p>
            <h3 id="delete-student-title">Eliminar estudiante</h3>
            <p className="modal-copy">
              Esta acción eliminará el estudiante del sistema. Verifica los datos antes de continuar.
            </p>
            <pre className="modal-details">{[
              `documento: ${studentDeleteTarget.documento || "-"}`,
              `nombre: ${studentDeleteTarget.nombre || "-"}`,
              `placa: ${studentDeleteTarget.placa || "-"}`,
              `vigencia: ${studentDeleteTarget.vigencia ? "Activa" : "Inactiva"}`,
              `actualizado_por: ${studentDeleteTarget.updated_by_username || "Sin responsable"}`,
            ].join("\n")}</pre>
            <div className="button-strip">
              <button
                type="button"
                className="danger-button"
                disabled={loading}
                onClick={handleConfirmDeleteStudent}
              >
                {loading ? "Eliminando..." : "Confirmar eliminación"}
              </button>
              <button
                type="button"
                className="ghost-button"
                disabled={loading}
                onClick={() => setStudentDeleteTarget(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
