import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

const initialForm = {
  username: "",
  password: "",
  role: "CONSULTA",
};

const REJECTION_TEMPLATES = [
  {
    value: "DOCUMENTACION_INCOMPLETA",
    label: "Documentación incompleta",
    message: "La solicitud fue rechazada porque la documentación adjunta está incompleta o no permite validar la información requerida.",
  },
  {
    value: "DOCUMENTACION_ERRONEA",
    label: "Documentación adjunta errónea",
    message: "La solicitud fue rechazada porque la documentación adjunta no corresponde al estudiante o presenta inconsistencias frente a los datos registrados.",
  },
  {
    value: "QR_INVALIDO",
    label: "QR institucional no válido",
    message: "La solicitud fue rechazada porque el QR institucional no corresponde al estudiante o no cumple con el formato válido de SIUC.",
  },
  {
    value: "PLACAS_INCONSISTENTES",
    label: "Inconsistencia en vehículos",
    message: "La solicitud fue rechazada porque las placas o tarjetas de propiedad registradas presentan inconsistencias y deben ser corregidas.",
  },
  {
    value: "CORREO_INVALIDO",
    label: "Correo institucional inválido",
    message: "La solicitud fue rechazada porque el correo institucional registrado no cumple con las condiciones requeridas para el proceso.",
  },
  {
    value: "OTRO",
    label: "Otro motivo",
    message: "",
  },
];

export default function Admin() {
  const { apiRequest, user } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [estudiantes, setEstudiantes] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [adminView, setAdminView] = useState("gestion");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [userDeleteTarget, setUserDeleteTarget] = useState(null);
  const [userRestoreTarget, setUserRestoreTarget] = useState(null);
  const [userPasswordTarget, setUserPasswordTarget] = useState(null);
  const [studentDeleteTarget, setStudentDeleteTarget] = useState(null);
  const [studentRestoreTarget, setStudentRestoreTarget] = useState(null);
  const [studentFilter, setStudentFilter] = useState("");
  const [requestFilter, setRequestFilter] = useState("PENDIENTE");
  const [studentDeleteIssue, setStudentDeleteIssue] = useState("");
  const [studentDeleteStatus, setStudentDeleteStatus] = useState({
    checking: false,
    insideCampus: false,
    canDeactivate: true,
    lastMovement: null,
    message: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    password: "",
    confirmPassword: "",
  });
  const [requestApproveTarget, setRequestApproveTarget] = useState(null);
  const [requestRejectTarget, setRequestRejectTarget] = useState(null);
  const [requestReviewForm, setRequestReviewForm] = useState({
    notas_revision: "",
    motivo_rechazo: "",
    rejection_template: "",
  });

  async function loadUsers() {
    const data = await apiRequest("/admin/usuarios");
    setUsuarios(data.usuarios || []);
  }

  async function loadStudents() {
    const data = await apiRequest("/admin/estudiantes");
    setEstudiantes(data.estudiantes || []);
  }

  async function loadRequests(nextState = requestFilter) {
    const query = nextState && nextState !== "TODAS" ? `?estado=${encodeURIComponent(nextState)}` : "";
    const data = await apiRequest(`/solicitudes-inscripcion${query}`);
    setSolicitudes(data.solicitudes || []);
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setError("");

      try {
        const [usersData, studentsData, requestsData] = await Promise.all([
          apiRequest("/admin/usuarios"),
          apiRequest("/admin/estudiantes"),
          apiRequest("/solicitudes-inscripcion?estado=PENDIENTE"),
        ]);

        if (!cancelled) {
          setUsuarios(usersData.usuarios || []);
          setEstudiantes(studentsData.estudiantes || []);
          setSolicitudes(requestsData.solicitudes || []);
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

  useEffect(() => {
    let cancelled = false;

    async function refreshRequests() {
      try {
        const query = requestFilter && requestFilter !== "TODAS" ? `?estado=${encodeURIComponent(requestFilter)}` : "";
        const data = await apiRequest(`/solicitudes-inscripcion${query}`);
        if (!cancelled) {
          setSolicitudes(data.solicitudes || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      }
    }

    refreshRequests();

    return () => {
      cancelled = true;
    };
  }, [apiRequest, requestFilter]);

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

      setStatus(`Estudiante ${data.estudiante.nombre} desactivado correctamente.`);
      setStudentDeleteIssue("");
      setStudentDeleteTarget(null);
      await loadStudents();
    } catch (err) {
      if (err.code === "STUDENT_INSIDE_CAMPUS") {
        setStudentDeleteIssue(err.message);
        setStudentDeleteStatus((current) => ({
          ...current,
          insideCampus: true,
          canDeactivate: false,
          message: err.message,
          lastMovement: "ENTRADA",
        }));
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmDeleteUser() {
    if (!userDeleteTarget) return;

    setLoading(true);
    setError("");
    setStatus("");

    try {
      const data = await apiRequest(`/admin/usuarios/${userDeleteTarget.id}`, {
        method: "DELETE",
      });

      setStatus(`Usuario ${data.usuario.username} desactivado correctamente.`);
      setUserDeleteTarget(null);
      await loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmRestoreUser() {
    if (!userRestoreTarget) return;

    setLoading(true);
    setError("");
    setStatus("");

    try {
      const data = await apiRequest(`/admin/usuarios/${userRestoreTarget.id}/reactivar`, {
        method: "PATCH",
      });

      setStatus(`Usuario ${data.usuario.username} reactivado correctamente.`);
      setUserRestoreTarget(null);
      await loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmRestoreStudent() {
    if (!studentRestoreTarget) return;

    setLoading(true);
    setError("");
    setStatus("");

    try {
      const data = await apiRequest(`/admin/estudiantes/documento/${encodeURIComponent(studentRestoreTarget.documento)}/reactivar`, {
        method: "PATCH",
      });

      setStatus(`Estudiante ${data.estudiante.nombre} reactivado correctamente.`);
      setStudentRestoreTarget(null);
      await loadStudents();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterExitAndDeleteStudent() {
    if (!studentDeleteTarget) return;

    setLoading(true);
    setError("");
    setStatus("");

    try {
      const data = await apiRequest(
        `/admin/estudiantes/documento/${encodeURIComponent(studentDeleteTarget.documento)}/registrar-salida`,
        { method: "POST" }
      );

      setStatus(`Salida registrada para ${data.estudiante.nombre}. Ya puedes confirmar la desactivación.`);
      setStudentDeleteIssue("");
      setStudentDeleteStatus({
        checking: false,
        insideCampus: false,
        canDeactivate: true,
        lastMovement: "SALIDA",
        message: "La salida ya fue registrada. Ahora puedes desactivar al estudiante con seguridad.",
      });
      await loadStudents();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleChangePassword() {
    if (!userPasswordTarget) return;

    if (!passwordForm.password || passwordForm.password.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (passwordForm.password !== passwordForm.confirmPassword) {
      setError("La confirmación de contraseña no coincide.");
      return;
    }

    setLoading(true);
    setError("");
    setStatus("");

    try {
      const data = await apiRequest(`/admin/usuarios/${userPasswordTarget.id}`, {
        method: "PUT",
        body: JSON.stringify({ password: passwordForm.password }),
      });

      setStatus(`Contraseña actualizada para ${data.usuario.username}.`);
      setPasswordForm({ password: "", confirmPassword: "" });
      setUserPasswordTarget(null);
      await loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleApproveRequest() {
    if (!requestApproveTarget) return;

    setLoading(true);
    setError("");
    setStatus("");

    try {
      const data = await apiRequest(`/solicitudes-inscripcion/${requestApproveTarget.id}/aprobar`, {
        method: "PATCH",
        body: JSON.stringify({ notas_revision: requestReviewForm.notas_revision }),
      });

      setStatus(`Solicitud ${data.solicitud.id} aprobada y estudiante creado correctamente.`);
      setRequestApproveTarget(null);
      setRequestReviewForm({ notas_revision: "", motivo_rechazo: "", rejection_template: "" });
      await Promise.all([loadStudents(), loadRequests()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRejectRequest() {
    if (!requestRejectTarget) return;

    if (!requestReviewForm.motivo_rechazo.trim()) {
      setError("Debes indicar el motivo del rechazo.");
      return;
    }

    setLoading(true);
    setError("");
    setStatus("");

    try {
      const data = await apiRequest(`/solicitudes-inscripcion/${requestRejectTarget.id}/rechazar`, {
        method: "PATCH",
        body: JSON.stringify({
          motivo_rechazo: requestReviewForm.motivo_rechazo,
          notas_revision: requestReviewForm.notas_revision,
        }),
      });

      setStatus(`Solicitud ${data.solicitud.id} rechazada correctamente.`);
      setRequestRejectTarget(null);
      setRequestReviewForm({ notas_revision: "", motivo_rechazo: "", rejection_template: "" });
      await loadRequests();
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

  const visibleRequests = useMemo(() => solicitudes, [solicitudes]);

  function applyRejectionTemplate(templateValue) {
    const template = REJECTION_TEMPLATES.find((item) => item.value === templateValue);
    setRequestReviewForm((current) => ({
      ...current,
      rejection_template: templateValue,
      motivo_rechazo: template ? template.message : "",
    }));
  }

  function openRequestDocument(url) {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  useEffect(() => {
    let cancelled = false;

    async function loadStudentDeleteStatus() {
      if (!studentDeleteTarget) {
        setStudentDeleteIssue("");
        setStudentDeleteStatus({
          checking: false,
          insideCampus: false,
          canDeactivate: true,
          lastMovement: null,
          message: "",
        });
        return;
      }

      setStudentDeleteIssue("");
      setStudentDeleteStatus({
        checking: true,
        insideCampus: false,
        canDeactivate: true,
        lastMovement: null,
        message: "Verificando si el estudiante sigue dentro del campus...",
      });

      try {
        const data = await apiRequest(
          `/admin/estudiantes/documento/${encodeURIComponent(studentDeleteTarget.documento)}/estado-desactivacion`
        );

        if (!cancelled) {
          setStudentDeleteStatus({
            checking: false,
            insideCampus: Boolean(data.insideCampus),
            canDeactivate: Boolean(data.canDeactivate),
            lastMovement: data.lastMovement || null,
            message: data.message || "",
          });
        }
      } catch (err) {
        if (!cancelled) {
          setStudentDeleteIssue(err.message);
          setStudentDeleteStatus({
            checking: false,
            insideCampus: false,
            canDeactivate: true,
            lastMovement: null,
            message: "",
          });
        }
      }
    }

    loadStudentDeleteStatus();

    return () => {
      cancelled = true;
    };
  }, [apiRequest, studentDeleteTarget]);

  return (
    <section className="page">
      <header className="page__header">
        <p className="eyebrow">Administración</p>
        <h2>Herramientas exclusivas de ADMIN</h2>
        <p>
          Desde aquí puedes crear usuarios, revisar estudiantes y gestionar la operación administrativa del sistema.
        </p>
      </header>

      <div className="admin-view-tabs" role="tablist" aria-label={"Secciones de administración"}>
        <button
          type="button"
          role="tab"
          aria-selected={adminView === "gestion"}
          className={adminView === "gestion" ? "admin-view-tab is-active" : "admin-view-tab"}
          onClick={() => setAdminView("gestion")}
        >
          {"Gestión"}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={adminView === "admisiones"}
          className={adminView === "admisiones" ? "admin-view-tab is-active" : "admin-view-tab"}
          onClick={() => setAdminView("admisiones")}
        >
          Admisiones
        </button>
      </div>

      {error ? <div className="form-error">{error}</div> : null}
      {status ? <div className="form-success">{status}</div> : null}

      {adminView === "gestion" ? (
        <>
      <div className="cards-grid cards-grid--single">
        <article className="info-card">
          <h3>Crear nuevo usuario</h3>
          <form className="stack-form" onSubmit={handleCreateUser} autoComplete="off">
            <input type="text" name="admin-fake-user" autoComplete="username" tabIndex="-1" hidden readOnly />
            <input type="password" name="admin-fake-pass" autoComplete="current-password" tabIndex="-1" hidden readOnly />
            <label>
              Username
              <input
                type="text"
                name="admin_create_username"
                value={form.username}
                onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                autoComplete="off"
                spellCheck="false"
                placeholder="nuevo.usuario"
                required
              />
            </label>

            <label>
              Contraseña
              <input
                type="password"
                name="admin_create_password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                autoComplete="new-password"
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

      </div>

      <section className="table-panel">
        <div className="table-panel__header">
          <div>
            <p className="eyebrow">Gestión de usuarios</p>
            <h3>Usuarios del sistema</h3>
          </div>
          <span className="table-count">{usuarios.length} visible(s)</span>
        </div>
        {usuarios.length === 0 ? (
          <div className="empty-state">No hay usuarios creados.</div>
        ) : (
          <div className="table-wrap table-wrap--panel">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Creado</th>
                  <th>Actualizado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((account) => (
                  <tr key={account.id}>
                    <td>{account.id}</td>
                    <td>{account.username}</td>
                    <td>{account.role}</td>
                    <td>{account.is_active ? "Activo" : "Desactivado"}</td>
                    <td>{account.created_at ? new Date(account.created_at).toLocaleString("es-CO") : "-"}</td>
                    <td>{account.updated_at ? new Date(account.updated_at).toLocaleString("es-CO") : "-"}</td>
                    <td>
                      <div className="button-strip">
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => {
                            setError("");
                            setPasswordForm({ password: "", confirmPassword: "" });
                            setUserPasswordTarget(account);
                          }}
                        >
                          Cambiar contraseña
                        </button>
                        {account.username === "admin" ? (
                          <span className="movement-pill entry">Protegido</span>
                        ) : account.id === user?.id ? (
                          <span className="movement-pill exit">Sesión actual</span>
                        ) : account.is_active ? (
                          <button
                            type="button"
                            className="danger-button"
                            onClick={() => setUserDeleteTarget(account)}
                          >
                            Desactivar
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => setUserRestoreTarget(account)}
                          >
                            Reactivar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

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
                  <th>Creado</th>
                  <th>Actualizado</th>
                  <th>Creado por</th>
                  <th>Actualizado por</th>
                  <th>Estado</th>
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
                    <td>{student.created_at ? new Date(student.created_at).toLocaleString("es-CO") : "-"}</td>
                    <td>{student.updated_at ? new Date(student.updated_at).toLocaleString("es-CO") : "-"}</td>
                    <td>{student.created_by_username || "Sin responsable"}</td>
                    <td>{student.updated_by_username || "Sin responsable"}</td>
                    <td>{student.is_deleted ? "Desactivado" : "Activo"}</td>
                    <td>
                      {student.is_deleted ? (
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => setStudentRestoreTarget(student)}
                        >
                          Reactivar
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="danger-button"
                          onClick={() => setStudentDeleteTarget(student)}
                        >
                          Desactivar
                        </button>
                      )}
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
          Aquí ADMIN ya puede crear usuarios, revisar estudiantes, desactivar o reactivar registros y aprobar solicitudes de inscripción sin perder historial.
        </div>
      </article>
        </>
      ) : null}

      {adminView === "admisiones" ? (
        <>
          <article className="info-card">
            <h3>Admisiones y aprobaciones</h3>
            <div className="empty-state">
              {"Aquí ADMIN revisa solicitudes de inscripción, aprueba o rechaza registros y controla el flujo previo a la activación del estudiante."}
            </div>
          </article>

      <section className="table-panel">
        <div className="table-panel__header admin-table-header">
          <div>
            <p className="eyebrow">Solicitudes de inscripción</p>
            <h3>Bandeja de aprobación administrativa</h3>
          </div>
          <div className="admin-table-tools">
            <select value={requestFilter} onChange={(event) => setRequestFilter(event.target.value)}>
              <option value="PENDIENTE">Pendientes</option>
              <option value="APROBADA">Aprobadas</option>
              <option value="RECHAZADA">Rechazadas</option>
              <option value="EXPIRADA">Expiradas</option>
              <option value="TODAS">Todas</option>
            </select>
            <span className="table-count">{visibleRequests.length} visible(s)</span>
          </div>
        </div>

        {visibleRequests.length === 0 ? (
          <div className="empty-state">No hay solicitudes para el filtro seleccionado.</div>
        ) : (
          <div className="table-wrap table-wrap--scrollable table-wrap--panel">
            <table className="data-table request-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Estudiante</th>
                  <th>Correo</th>
                  <th>Principal</th>
                  <th>Secundaria</th>
                  <th>Adjuntos</th>
                  <th>Estado</th>
                  <th>Expira</th>
                  <th>Revisión</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {visibleRequests.map((request) => (
                  <tr key={request.id}>
                    <td>{request.id}</td>
                    <td>
                      <div className="movement-cell-strong">
                        <span className="movement-main">{request.nombre}</span>
                        <span className="movement-sub">DOC {request.documento} · {request.carrera}</span>
                      </div>
                    </td>
                    <td>{request.correo_institucional}</td>
                    <td>
                      <div className="movement-cell-strong">
                        <span className="movement-main">{request.placa}</span>
                        <span className="movement-sub">{request.color}</span>
                      </div>
                    </td>
                    <td>
                      {request.placa_secundaria ? (
                        <div className="movement-cell-strong">
                          <span className="movement-main">{request.placa_secundaria}</span>
                          <span className="movement-sub">{request.color_secundaria || "-"}</span>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      <div className="movement-cell-strong">
                        <span className="movement-sub">QR: {request.qr_imagen_url}</span>
                        <span className="movement-sub">Tarjeta 1: {request.tarjeta_propiedad_principal_url}</span>
                        <span className="movement-sub">Tarjeta 2: {request.tarjeta_propiedad_secundaria_url || "-"}</span>
                      </div>
                    </td>
                    <td>{request.estado}</td>
                    <td>{request.expires_at ? new Date(request.expires_at).toLocaleString("es-CO") : "-"}</td>
                    <td>
                      <div className="movement-cell-strong">
                        <span className="movement-sub">{request.reviewed_by_username || "Sin revisar"}</span>
                        <span className="movement-sub">{request.reviewed_at ? new Date(request.reviewed_at).toLocaleString("es-CO") : "-"}</span>
                      </div>
                    </td>
                    <td>
                      {request.estado === "PENDIENTE" ? (
                        <div className="button-strip">
                          <button
                            type="button"
                            onClick={() => {
                              setRequestReviewForm({ notas_revision: "", motivo_rechazo: "", rejection_template: "" });
                              setRequestApproveTarget(request);
                            }}
                          >
                            Aprobar
                          </button>
                          <button
                            type="button"
                            className="danger-button"
                            onClick={() => {
                              setRequestReviewForm({ notas_revision: "", motivo_rechazo: "", rejection_template: "" });
                              setRequestRejectTarget(request);
                            }}
                          >
                            Rechazar
                          </button>
                        </div>
                      ) : (
                        <span className="movement-pill entry">Procesada</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

          <article className="info-card">
            <h3>{"Estado del módulo de admisiones"}</h3>
            <div className="empty-state">
              {"Aquí ADMIN revisa las solicitudes, deja trazabilidad de la decisión y prepara el flujo de correo y expiración automática."}
            </div>
          </article>
        </>
      ) : null}

      {userDeleteTarget ? (
        <div className="modal" aria-hidden="false">
          <div className="modal-backdrop" onClick={() => setUserDeleteTarget(null)} />
          <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="delete-user-title">
            <p className="eyebrow">Confirmación requerida</p>
            <h3 id="delete-user-title">Desactivar usuario</h3>
            <p className="modal-copy">
              Esta acción bloqueará el acceso del usuario, pero conservará los movimientos y la auditoría histórica.
            </p>
            <pre className="modal-details">{[
              `id: ${userDeleteTarget.id || "-"}`,
              `usuario: ${userDeleteTarget.username || "-"}`,
              `rol: ${userDeleteTarget.role || "-"}`,
              `creado: ${userDeleteTarget.created_at ? new Date(userDeleteTarget.created_at).toLocaleString("es-CO") : "-"}`,
            ].join("\n")}</pre>
            <div className="button-strip">
              <button
                type="button"
                className="danger-button"
                disabled={loading}
                onClick={handleConfirmDeleteUser}
              >
                {loading ? "Desactivando..." : "Confirmar desactivación"}
              </button>
              <button
                type="button"
                className="ghost-button"
                disabled={loading}
                onClick={() => setUserDeleteTarget(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {userPasswordTarget ? (
        <div className="modal" aria-hidden="false">
          <div className="modal-backdrop" onClick={() => setUserPasswordTarget(null)} />
          <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="password-user-title">
            <p className="eyebrow">Administración de acceso</p>
            <h3 id="password-user-title">Cambiar contraseña de usuario</h3>
            <p className="modal-copy">
              Esta acción solo está disponible desde administración. Define una nueva contraseña segura para el usuario seleccionado.
            </p>
            <pre className="modal-details">{[
              `id: ${userPasswordTarget.id || "-"}`,
              `usuario: ${userPasswordTarget.username || "-"}`,
              `rol: ${userPasswordTarget.role || "-"}`,
            ].join("\n")}</pre>
            <div className="stack-form">
              <label>
                Nueva contraseña
                <input
                  type="password"
                  value={passwordForm.password}
                  onChange={(event) => setPasswordForm((current) => ({ ...current, password: event.target.value }))}
                  placeholder="Mínimo 8 caracteres"
                  minLength={8}
                  autoComplete="new-password"
                />
              </label>
              <label>
                Confirmar contraseña
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                  placeholder="Repite la nueva contraseña"
                  minLength={8}
                  autoComplete="new-password"
                />
              </label>
            </div>
            <div className="button-strip">
              <button type="button" disabled={loading} onClick={handleChangePassword}>
                {loading ? "Actualizando..." : "Guardar contraseña"}
              </button>
              <button
                type="button"
                className="ghost-button"
                disabled={loading}
                onClick={() => {
                  setPasswordForm({ password: "", confirmPassword: "" });
                  setUserPasswordTarget(null);
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {userRestoreTarget ? (
        <div className="modal" aria-hidden="false">
          <div className="modal-backdrop" onClick={() => setUserRestoreTarget(null)} />
          <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="restore-user-title">
            <p className="eyebrow">Confirmación requerida</p>
            <h3 id="restore-user-title">Reactivar usuario</h3>
            <p className="modal-copy">
              Esta acción devolverá el acceso al usuario y mantendrá intacta la trazabilidad histórica del sistema.
            </p>
            <pre className="modal-details">{[
              `id: ${userRestoreTarget.id || "-"}`,
              `usuario: ${userRestoreTarget.username || "-"}`,
              `rol: ${userRestoreTarget.role || "-"}`,
              `desactivado: ${userRestoreTarget.deactivated_at ? new Date(userRestoreTarget.deactivated_at).toLocaleString("es-CO") : "-"}`,
            ].join("\n")}</pre>
            <div className="button-strip">
              <button
                type="button"
                disabled={loading}
                onClick={handleConfirmRestoreUser}
              >
                {loading ? "Reactivando..." : "Confirmar reactivación"}
              </button>
              <button
                type="button"
                className="ghost-button"
                disabled={loading}
                onClick={() => setUserRestoreTarget(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {studentDeleteTarget ? (
        <div className="modal" aria-hidden="false">
          <div className="modal-backdrop" onClick={() => {
            setStudentDeleteIssue("");
            setStudentDeleteStatus({
              checking: false,
              insideCampus: false,
              canDeactivate: true,
              lastMovement: null,
              message: "",
            });
            setStudentDeleteTarget(null);
          }} />
          <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="delete-student-title">
            <p className="eyebrow">Confirmación requerida</p>
            <h3 id="delete-student-title">Desactivar estudiante</h3>
            <p className="modal-copy">
              Esta acción desactivará el estudiante, pero conservará sus movimientos y el historial del sistema.
            </p>
            {studentDeleteStatus.message ? (
              <div className={studentDeleteStatus.insideCampus ? "form-error" : "auth-status"}>
                {studentDeleteStatus.message}
              </div>
            ) : null}
            {studentDeleteIssue ? (
              <div className="form-error">{studentDeleteIssue}</div>
            ) : null}
            <pre className="modal-details">{[
              `documento: ${studentDeleteTarget.documento || "-"}`,
              `nombre: ${studentDeleteTarget.nombre || "-"}`,
              `placa: ${studentDeleteTarget.placa || "-"}`,
              `vigencia: ${studentDeleteTarget.vigencia ? "Activa" : "Inactiva"}`,
              `estado_campus: ${studentDeleteStatus.insideCampus ? "Dentro del campus" : "Fuera del campus"}`,
              `último_movimiento: ${studentDeleteStatus.lastMovement || "Sin registro"}`,
              `actualizado_por: ${studentDeleteTarget.updated_by_username || "Sin responsable"}`,
            ].join("\n")}</pre>
            <div className="button-strip">
              <button
                type="button"
                className="danger-button"
                disabled={loading || studentDeleteStatus.checking || !studentDeleteStatus.canDeactivate}
                onClick={handleConfirmDeleteStudent}
              >
                {loading ? "Desactivando..." : "Confirmar desactivación"}
              </button>
              {studentDeleteStatus.insideCampus ? (
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleRegisterExitAndDeleteStudent}
                >
                  {loading ? "Registrando..." : "Sí, registrar salida"}
                </button>
              ) : null}
              <button
                type="button"
                className="ghost-button"
                disabled={loading}
                onClick={() => {
                  setStudentDeleteIssue("");
                  setStudentDeleteStatus({
                    checking: false,
                    insideCampus: false,
                    canDeactivate: true,
                    lastMovement: null,
                    message: "",
                  });
                  setStudentDeleteTarget(null);
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {studentRestoreTarget ? (
        <div className="modal" aria-hidden="false">
          <div className="modal-backdrop" onClick={() => setStudentRestoreTarget(null)} />
          <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="restore-student-title">
            <p className="eyebrow">Confirmación requerida</p>
            <h3 id="restore-student-title">Reactivar estudiante</h3>
            <p className="modal-copy">
              Esta acción habilitará nuevamente al estudiante para operación, sin perder movimientos ni auditoría.
            </p>
            <pre className="modal-details">{[
              `documento: ${studentRestoreTarget.documento || "-"}`,
              `nombre: ${studentRestoreTarget.nombre || "-"}`,
              `placa: ${studentRestoreTarget.placa || "-"}`,
              `desactivado: ${studentRestoreTarget.deleted_at ? new Date(studentRestoreTarget.deleted_at).toLocaleString("es-CO") : "-"}`,
            ].join("\n")}</pre>
            <div className="button-strip">
              <button
                type="button"
                disabled={loading}
                onClick={handleConfirmRestoreStudent}
              >
                {loading ? "Reactivando..." : "Confirmar reactivación"}
              </button>
              <button
                type="button"
                className="ghost-button"
                disabled={loading}
                onClick={() => setStudentRestoreTarget(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {requestApproveTarget ? (
        <div className="modal" aria-hidden="false">
          <div className="modal-backdrop" onClick={() => setRequestApproveTarget(null)} />
          <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="approve-request-title">
            <p className="eyebrow">Validación administrativa</p>
            <h3 id="approve-request-title">Aprobar solicitud de inscripción</h3>
            <p className="modal-copy">
              Al aprobar esta solicitud se creará el estudiante activo con sus motos registradas y quedará trazabilidad del revisor.
            </p>
            <pre className="modal-details">{[
              `id: ${requestApproveTarget.id}`,
              `documento: ${requestApproveTarget.documento}`,
              `nombre: ${requestApproveTarget.nombre}`,
              `correo: ${requestApproveTarget.correo_institucional}`,
              `principal: ${requestApproveTarget.placa} · ${requestApproveTarget.color}`,
              `secundaria: ${requestApproveTarget.placa_secundaria || "-"} · ${requestApproveTarget.color_secundaria || "-"}`,
              `adjunto QR: ${requestApproveTarget.qr_imagen_url}`,
            ].join("\n")}</pre>
            <div className="button-strip">
              <button type="button" className="ghost-button" onClick={() => openRequestDocument(requestApproveTarget.qr_imagen_url)}>
                Ver QR adjunto
              </button>
              <button type="button" className="ghost-button" onClick={() => openRequestDocument(requestApproveTarget.tarjeta_propiedad_principal_url)}>
                Ver tarjeta principal
              </button>
              {requestApproveTarget.tarjeta_propiedad_secundaria_url ? (
                <button type="button" className="ghost-button" onClick={() => openRequestDocument(requestApproveTarget.tarjeta_propiedad_secundaria_url)}>
                  Ver tarjeta secundaria
                </button>
              ) : null}
            </div>
            <label>
              Notas de revisión
              <input
                type="text"
                value={requestReviewForm.notas_revision}
                onChange={(event) => setRequestReviewForm((current) => ({ ...current, notas_revision: event.target.value }))}
                placeholder="Observación interna opcional"
              />
            </label>
            <div className="button-strip">
              <button type="button" disabled={loading} onClick={handleApproveRequest}>
                {loading ? "Aprobando..." : "Confirmar aprobación"}
              </button>
              <button type="button" className="ghost-button" disabled={loading} onClick={() => setRequestApproveTarget(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {requestRejectTarget ? (
        <div className="modal" aria-hidden="false">
          <div className="modal-backdrop" onClick={() => setRequestRejectTarget(null)} />
          <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="reject-request-title">
            <p className="eyebrow">Validación administrativa</p>
            <h3 id="reject-request-title">Rechazar solicitud de inscripción</h3>
            <p className="modal-copy">
              Selecciona un motivo predefinido o ajusta el mensaje final. El sistema enviará la respuesta al correo institucional del solicitante.
            </p>
            <pre className="modal-details">{[
              `id: ${requestRejectTarget.id}`,
              `documento: ${requestRejectTarget.documento}`,
              `nombre: ${requestRejectTarget.nombre}`,
              `correo: ${requestRejectTarget.correo_institucional}`,
            ].join("\n")}</pre>
            <div className="stack-form">
              <label>
                Mensaje predefinido de rechazo
                <select
                  value={requestReviewForm.rejection_template}
                  onChange={(event) => applyRejectionTemplate(event.target.value)}
                >
                  <option value="">Selecciona un motivo</option>
                  {REJECTION_TEMPLATES.map((template) => (
                    <option key={template.value} value={template.value}>
                      {template.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Mensaje final de rechazo
                <textarea
                  value={requestReviewForm.motivo_rechazo}
                  onChange={(event) => setRequestReviewForm((current) => ({ ...current, motivo_rechazo: event.target.value }))}
                  placeholder="Escribe o ajusta el mensaje que recibirá el solicitante"
                  rows={4}
                />
              </label>
              <label>
                Notas de revisión
                <input
                  type="text"
                  value={requestReviewForm.notas_revision}
                  onChange={(event) => setRequestReviewForm((current) => ({ ...current, notas_revision: event.target.value }))}
                  placeholder="Detalle adicional opcional"
                />
              </label>
            </div>
            <div className="button-strip">
              <button type="button" className="ghost-button" onClick={() => openRequestDocument(requestRejectTarget.qr_imagen_url)}>
                Ver QR adjunto
              </button>
              <button type="button" className="ghost-button" onClick={() => openRequestDocument(requestRejectTarget.tarjeta_propiedad_principal_url)}>
                Ver tarjeta principal
              </button>
              {requestRejectTarget.tarjeta_propiedad_secundaria_url ? (
                <button type="button" className="ghost-button" onClick={() => openRequestDocument(requestRejectTarget.tarjeta_propiedad_secundaria_url)}>
                  Ver tarjeta secundaria
                </button>
              ) : null}
            </div>
            <div className="button-strip">
              <button type="button" className="danger-button" disabled={loading} onClick={handleRejectRequest}>
                {loading ? "Rechazando..." : "Confirmar rechazo"}
              </button>
              <button type="button" className="ghost-button" disabled={loading} onClick={() => setRequestRejectTarget(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
