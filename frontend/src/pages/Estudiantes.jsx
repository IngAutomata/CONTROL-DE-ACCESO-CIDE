import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import QrScanner from "../components/QrScanner.jsx";
import { CAREERS } from "../constants/careers.js";

const PLATE_REGEX = /^[A-Z]{3}\d{2}[A-Z]$/;
const DOCUMENT_REGEX = /^\d{8,10}$/;
const CELULAR_REGEX = /^\d{10}$/;
const CIDE_QR_REGEX = /^https:\/\/soe\.cide\.edu\.co\/verificar-estudiante\/[A-Za-z0-9]{1,8}$/;

const initialForm = {
  documento: "",
  qr_uid: "",
  nombre: "",
  carrera: CAREERS[0],
  celular: "",
  placa: "",
  color: "",
  placa_secundaria: "",
  color_secundaria: "",
  vigencia: true,
};

function normalizePlate(value) {
  return (value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function normalizeDocumento(value) {
  return (value || "").replace(/\D/g, "").slice(0, 10);
}

function normalizeCelular(value) {
  return (value || "").replace(/\D/g, "").slice(0, 10);
}

function normalizeQr(value) {
  return (value || "").trim();
}

function getQrCandidates(value) {
  const trimmed = (value || "").trim();
  if (!trimmed) return [];

  const candidates = new Set([trimmed]);

  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length > 0) {
      candidates.add(parts[parts.length - 1]);
    }
  } catch (_) {
    const plain = trimmed.split(/[?#]/)[0];
    const parts = plain.split("/").filter(Boolean);
    if (parts.length > 0) {
      candidates.add(parts[parts.length - 1]);
    }
  }

  return Array.from(candidates);
}

function mapStudentToForm(student) {
  if (!student) return initialForm;

  return {
    documento: student.documento || "",
    qr_uid: normalizeQr(student.qr_uid || ""),
    nombre: student.nombre || "",
    carrera: student.carrera || CAREERS[0],
    celular: normalizeCelular(student.celular || ""),
    placa: normalizePlate(student.placa || ""),
    color: student.color || "",
    placa_secundaria: normalizePlate(student.placa_secundaria || ""),
    color_secundaria: student.color_secundaria || "",
    vigencia: Boolean(student.vigencia),
  };
}

export default function Estudiantes() {
  const { apiRequest, role } = useAuth();
  const [students, setStudents] = useState([]);
  const [lookupValue, setLookupValue] = useState("");
  const [lookupMode, setLookupMode] = useState("documento");
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentMode, setCurrentMode] = useState("crear");
  const [originalDocumento, setOriginalDocumento] = useState("");
  const [showStudentsTable, setShowStudentsTable] = useState(false);
  const [scannedStudent, setScannedStudent] = useState(null);
  const [confirmState, setConfirmState] = useState({
    open: false,
    payload: null,
    details: null,
  });

  const canManageStudents = useMemo(() => ["ADMIN", "GUARDA"].includes(role), [role]);
  const isGuardEditing = useMemo(
    () => role === "GUARDA" && currentMode === "editar",
    [currentMode, role]
  );

  async function fetchStudents() {
    const data = await apiRequest("/estudiantes");
    setStudents(data.estudiantes || []);
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await apiRequest("/estudiantes");

        if (!cancelled) {
          setStudents(data.estudiantes || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [apiRequest]);

  async function handleLookup(event) {
    event.preventDefault();
    setError("");
    setStatus("");

    if (!lookupValue.trim()) {
      setError(`Debes indicar ${lookupMode === "documento" ? "un documento" : "una placa"} para buscar.`);
      return;
    }

    if (lookupMode === "documento" && !DOCUMENT_REGEX.test(normalizeDocumento(lookupValue))) {
      setError("La cédula debe tener entre 8 y 10 dígitos numéricos.");
      return;
    }

    setLoading(true);

    try {
      const lookupPath = lookupMode === "documento"
        ? `/estudiantes/documento/${encodeURIComponent(lookupValue.trim())}`
        : `/estudiantes/placa/${encodeURIComponent(normalizePlate(lookupValue))}`;
      const data = await apiRequest(lookupPath);

      setForm(mapStudentToForm(data));
      setOriginalDocumento(data.documento || "");
      setCurrentMode("editar");
      setScannedStudent(data);
      setStatus(`Estudiante ${data.nombre} cargado para ${canManageStudents ? "edición" : "consulta"}.`);
    } catch (err) {
      setError(err.message);
      setScannedStudent(null);
      if (lookupMode === "documento") {
        setForm((current) => ({ ...current, documento: normalizeDocumento(lookupValue) }));
      } else {
        setForm((current) => ({ ...current, placa: normalizePlate(lookupValue) }));
      }
      setCurrentMode("crear");
      setOriginalDocumento("");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!canManageStudents) {
      setError("Tu rol solo permite consultar estudiantes.");
      return;
    }

    setError("");
    setStatus("");

    if (!DOCUMENT_REGEX.test(form.documento)) {
      setError("La cédula debe tener entre 8 y 10 dígitos numéricos.");
      return;
    }

    if (form.celular && !CELULAR_REGEX.test(form.celular)) {
      setError("El celular debe contener exactamente 10 números.");
      return;
    }

    if (!CIDE_QR_REGEX.test(form.qr_uid)) {
      setError("El QR debe tener formato CIDE y terminar en un código alfanumérico de 1 a 8 caracteres.");
      return;
    }

    if (!PLATE_REGEX.test(form.placa)) {
      setError("La placa debe tener formato ABC12D.");
      return;
    }

    if ((form.placa_secundaria && !form.color_secundaria) || (!form.placa_secundaria && form.color_secundaria)) {
      setError("La moto secundaria requiere placa y color.");
      return;
    }

    if (form.placa_secundaria && !PLATE_REGEX.test(form.placa_secundaria)) {
      setError("La placa secundaria debe tener formato ABC12D.");
      return;
    }

    if (form.placa_secundaria && form.placa_secundaria === form.placa) {
      setError("La moto secundaria no puede repetir la placa principal.");
      return;
    }

    try {
      const isEditing = currentMode === "editar" && originalDocumento;
      if (isEditing) {
        setConfirmState({
          open: true,
          payload: { ...form },
          details: {
            documento_actual: originalDocumento,
            documento_nuevo: form.documento,
            nombre: form.nombre,
            carrera: form.carrera,
            celular: form.celular || "-",
            placa: form.placa,
            placa_secundaria: form.placa_secundaria || "-",
            color: form.color,
            color_secundaria: form.color_secundaria || "-",
            vigencia: form.vigencia ? "Activa" : "Inactiva",
          },
        });
        return;
      }

      await saveStudent(form, false);
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveStudent(payload, isEditing) {
    setLoading(true);

    try {
      const endpoint = isEditing
        ? `/estudiantes/documento/${encodeURIComponent(originalDocumento)}`
        : "/estudiantes/primer-ingreso";
      const method = isEditing ? "PUT" : "POST";
      const data = await apiRequest(endpoint, {
        method,
        body: JSON.stringify(payload),
      });

      const estudiante = data.estudiante || data;
      const actionLabel = isEditing ? "actualizado" : "creado";
      const successMessage = `Estudiante ${actionLabel} correctamente.`;

      if (isEditing) {
        setStatus(successMessage);
        setCurrentMode("editar");
        setOriginalDocumento(estudiante.documento || payload.documento);
        setLookupMode("documento");
        setLookupValue(estudiante.documento || payload.documento);
        setForm(mapStudentToForm(estudiante));
        setScannedStudent(estudiante);
      } else {
        setForm(initialForm);
        setLookupValue("");
        setLookupMode("documento");
        setCurrentMode("crear");
        setOriginalDocumento("");
        setScannedStudent(null);
        setStatus(successMessage);
      }
      setConfirmState({ open: false, payload: null, details: null });
      await fetchStudents();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleChange(field, value) {
    setForm((current) => ({
      ...current,
      [field]: field === "placa" || field === "placa_secundaria"
        ? normalizePlate(value)
        : field === "documento"
          ? normalizeDocumento(value)
          : field === "celular"
            ? normalizeCelular(value)
            : field === "qr_uid"
              ? normalizeQr(value)
              : value,
    }));
  }

  function resetForm() {
    setForm(initialForm);
    setLookupValue("");
    setLookupMode("documento");
    setCurrentMode("crear");
    setOriginalDocumento("");
    setScannedStudent(null);
    setConfirmState({ open: false, payload: null, details: null });
    setStatus("");
    setError("");
  }

  function formatConfirmationDetails(details) {
    if (!details) return "";

    return Object.entries(details)
      .map(([key, value]) => `${key}: ${value ?? "-"}`)
      .join("\n");
  }

  return (
    <section className="page">
      <header className="page__header">
        <p className="eyebrow">Estudiantes</p>
        <h2>{canManageStudents ? "Crear, buscar y actualizar estudiantes" : "Consulta de estudiantes"}</h2>
        <p>
          {canManageStudents
            ? "ADMIN y GUARDA pueden registrar estudiantes nuevos o buscarlos por documento o placa para actualizar sus datos."
            : "CONSULTA puede listar y buscar estudiantes, pero sin modificar registros."}
        </p>
      </header>

      <div className="cards-grid cards-grid--single">
        <article className="info-card info-card--workspace">
          <h3>{currentMode === "editar" ? "Registro cargado" : "Registrar o buscar estudiante"}</h3>
          <div className="workspace-mode-row">
            <span className={`movement-pill ${currentMode === "editar" ? "exit" : "entry"}`}>
              {currentMode === "editar" ? "Modo edición" : "Modo registro"}
            </span>
            <span className="workspace-mode-copy">
              {currentMode === "editar"
                ? "Estás trabajando sobre un estudiante existente."
                : "Completa el formulario para registrar un estudiante nuevo."}
            </span>
          </div>
          {isGuardEditing ? (
            <div className="form-note">
              Como GUARDA solo puedes actualizar placa, color, celular y vigencia. Los datos de identidad quedan protegidos.
            </div>
          ) : null}

          {canManageStudents ? (
            <div className="student-scan-block">
              <QrScanner
                title="Leer QR para primer ingreso"
                helpText="Escanea el QR del estudiante. Si ya existe en la base, cargaremos su información inmediatamente."
                buttonLabel="Escanear QR del estudiante"
                onScan={async (decodedText) => {
                  const qrValue = decodedText.trim();
                  if (!CIDE_QR_REGEX.test(qrValue)) {
                    setStatus("");
                    setError("El QR escaneado no tiene la estructura oficial de CIDE o supera 8 caracteres al final.");
                    return;
                  }
                  const candidates = getQrCandidates(qrValue);
                  const matchedStudent = students.find((student) => candidates.includes(student.qr_uid));
                  setError("");

                  if (matchedStudent) {
                    setForm(mapStudentToForm(matchedStudent));
                    setOriginalDocumento(matchedStudent.documento || "");
                    setCurrentMode("editar");
                    setScannedStudent(matchedStudent);
                    setLookupMode("documento");
                    setLookupValue(matchedStudent.documento || "");
                    setStatus(`QR reconocido. ${matchedStudent.nombre} cargado para edición.`);
                    return;
                  }

                  setForm({
                    ...initialForm,
                    qr_uid: qrValue,
                  });
                  setOriginalDocumento("");
                  setCurrentMode("crear");
                  setLookupMode("documento");
                  setLookupValue("");
                  setScannedStudent({
                    documento: "Sin registro",
                    nombre: "QR nuevo",
                    qr_uid: qrValue,
                    placa: "-",
                    carrera: "No encontrado en la base",
                    vigencia: false,
                    created_by_username: null,
                    updated_by_username: null,
                  });
                  setStatus("QR cargado en el formulario. Completa los datos para registrar al estudiante.");
                }}
              />

              <div className="student-scan-result">
                <h4>Información del estudiante escaneado</h4>
                {scannedStudent ? (
                  <dl className="scan-info-grid">
                    <div>
                      <dt>Nombre</dt>
                      <dd>{scannedStudent.nombre || "-"}</dd>
                    </div>
                    <div>
                      <dt>Documento</dt>
                      <dd>{scannedStudent.documento || "-"}</dd>
                    </div>
                    <div>
                      <dt>QR</dt>
                      <dd>{scannedStudent.qr_uid || "-"}</dd>
                    </div>
                    <div>
                      <dt>Moto principal</dt>
                      <dd>{scannedStudent.placa || "-"}</dd>
                    </div>
                    <div>
                      <dt>Moto secundaria</dt>
                      <dd>{scannedStudent.placa_secundaria || "-"}</dd>
                    </div>
                    <div>
                      <dt>Celular</dt>
                      <dd>{scannedStudent.celular || "-"}</dd>
                    </div>
                    <div>
                      <dt>Creado por</dt>
                      <dd>{scannedStudent.created_by_username || "Sin responsable"}</dd>
                    </div>
                    <div>
                      <dt>Actualizado por</dt>
                      <dd>{scannedStudent.updated_by_username || "Sin responsable"}</dd>
                    </div>
                  </dl>
                ) : (
                  <div className="empty-state">Escanea un QR para ver aquí la información del estudiante.</div>
                )}
              </div>
            </div>
          ) : null}

          <form className="inline-form student-lookup-form" onSubmit={handleLookup}>
            <select value={lookupMode} onChange={(event) => setLookupMode(event.target.value)}>
              <option value="documento">Buscar por documento</option>
              <option value="placa">Buscar por placa</option>
            </select>

            <input
              type="text"
              placeholder={lookupMode === "documento" ? "Ingresa el documento" : "Ingresa la placa, por ejemplo ABC12D"}
              value={lookupValue}
              onChange={(event) => setLookupValue(lookupMode === "placa" ? normalizePlate(event.target.value) : normalizeDocumento(event.target.value))}
              inputMode={lookupMode === "documento" ? "numeric" : undefined}
              maxLength={lookupMode === "documento" ? 10 : 6}
            />
            <button type="submit" disabled={loading}>
              {loading ? "Buscando..." : "Buscar"}
            </button>
          </form>

          <form className="stack-form" onSubmit={handleSubmit}>
            <div className="form-grid-2">
              <label>
                Documento
                <input
                  type="text"
                  value={form.documento}
                  onChange={(event) => handleChange("documento", event.target.value)}
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="Ejemplo: 12345678"
                  required
                  disabled={!canManageStudents || isGuardEditing}
                />
              </label>

              <label>
                QR UID
                <input
                  type="text"
                  value={form.qr_uid}
                  onChange={(event) => handleChange("qr_uid", event.target.value)}
                  placeholder="https://soe.cide.edu.co/verificar-estudiante/NjEyMzE2"
                  required
                  disabled={!canManageStudents || isGuardEditing}
                />
              </label>

              <label>
                Nombre
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(event) => handleChange("nombre", event.target.value)}
                  required
                  disabled={!canManageStudents || isGuardEditing}
                />
              </label>

              <label>
                Carrera
                <select
                  value={form.carrera}
                  onChange={(event) => handleChange("carrera", event.target.value)}
                  disabled={!canManageStudents || isGuardEditing}
                >
                  {CAREERS.map((career) => (
                    <option key={career} value={career}>
                      {career}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Celular
                <input
                  type="text"
                  value={form.celular}
                  onChange={(event) => handleChange("celular", event.target.value)}
                  placeholder="Número de contacto"
                  inputMode="numeric"
                  minLength={10}
                  maxLength={10}
                  disabled={!canManageStudents}
                />
              </label>

              <label>
                Moto principal
                <input
                  type="text"
                  value={form.placa}
                  onChange={(event) => handleChange("placa", event.target.value)}
                  required
                  placeholder="ABC12D"
                  disabled={!canManageStudents}
                />
              </label>

              <label>
                Color
                <input
                  type="text"
                  value={form.color}
                  onChange={(event) => handleChange("color", event.target.value)}
                  required
                  disabled={!canManageStudents}
                />
              </label>

              <label>
                Moto secundaria
                <input
                  type="text"
                  value={form.placa_secundaria}
                  onChange={(event) => handleChange("placa_secundaria", event.target.value)}
                  placeholder="ABC12D"
                  disabled={!canManageStudents}
                />
              </label>

              <label>
                Color moto secundaria
                <input
                  type="text"
                  value={form.color_secundaria}
                  onChange={(event) => handleChange("color_secundaria", event.target.value)}
                  placeholder="Color opcional"
                  disabled={!canManageStudents}
                />
              </label>
            </div>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.vigencia}
                onChange={(event) => handleChange("vigencia", event.target.checked)}
                disabled={!canManageStudents}
              />
              <span>Estudiante vigente</span>
            </label>

            <div className="button-strip">
              <button type="submit" disabled={loading || !canManageStudents}>
                {loading ? "Guardando..." : currentMode === "editar" ? "Guardar cambios" : "Crear estudiante"}
              </button>
              <button type="button" className="ghost-button" onClick={resetForm}>
                Nuevo registro
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setShowStudentsTable((current) => !current)}
              >
                {showStudentsTable ? "Ocultar listado" : "Ver estudiantes"}
              </button>
            </div>
          </form>

          {status ? <div className="form-success">{status}</div> : null}
          {error ? <div className="form-error">{error}</div> : null}
        </article>
      </div>

      {showStudentsTable ? (
        <section className="table-panel">
          <div className="table-panel__header">
            <div>
              <p className="eyebrow">Listado institucional</p>
              <h3>Estudiantes registrados</h3>
            </div>
            <button type="button" className="ghost-button" onClick={() => setShowStudentsTable(false)}>
              Cerrar
            </button>
          </div>

          {students.length === 0 ? (
            <div className="empty-state">Aún no hay estudiantes registrados.</div>
          ) : (
            <div className="table-wrap table-wrap--scrollable table-wrap--panel">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Documento</th>
                    <th>Nombre</th>
                    <th>QR</th>
                    <th>Moto principal</th>
                    <th>Moto secundaria</th>
                    <th>Celular</th>
                    <th>Vigencia</th>
                    <th>Creado por</th>
                    <th>Actualizado por</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student.estudiante_id}>
                      <td>{student.documento}</td>
                      <td>{student.nombre}</td>
                      <td>{student.qr_uid}</td>
                      <td>{student.placa || "-"}</td>
                      <td>{student.placa_secundaria || "-"}</td>
                      <td>{student.celular || "-"}</td>
                      <td>{student.vigencia ? "Vigente" : "No vigente"}</td>
                      <td>{student.created_by_username || "Sin responsable"}</td>
                      <td>{student.updated_by_username || "Sin responsable"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {confirmState.open ? (
        <div className="modal" aria-hidden="false">
          <div
            className="modal-backdrop"
            onClick={() => setConfirmState({ open: false, payload: null, details: null })}
          />
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-confirm-title"
          >
            <p className="eyebrow">Confirmación requerida</p>
            <h3 id="student-confirm-title">Confirmar cambios del estudiante</h3>
            <p className="modal-copy">
              Se va a editar este estudiante. ¿Estás seguro de que deseas modificarlo? Verifica la información antes de guardar.
            </p>
            <pre className="modal-details">{formatConfirmationDetails(confirmState.details)}</pre>
            <div className="button-strip">
              <button
                type="button"
                disabled={loading}
                onClick={() => saveStudent(confirmState.payload, true)}
              >
                {loading ? "Guardando..." : "Confirmar"}
              </button>
              <button
                type="button"
                className="ghost-button"
                disabled={loading}
                onClick={() => setConfirmState({ open: false, payload: null, details: null })}
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

