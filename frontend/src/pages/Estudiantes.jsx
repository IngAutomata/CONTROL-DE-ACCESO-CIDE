import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import QrScanner from "../components/QrScanner.jsx";

const PLATE_REGEX = /^[A-Z]{3}\d{2}[A-Z]$/;
const CAREERS = [
  "INGENIERIA DE SISTEMAS",
  "INGENIERIA INDUSTRIAL",
  "CONTADURIA PUBLICA",
  "ADMINISTRACION DE EMPRESAS",
  "DERECHO",
  "PSICOLOGIA",
  "TRABAJO SOCIAL",
  "LICENCIATURA EN PEDAGOGIA INFANTIL",
  "LICENCIATURA EN LENGUA CASTELLANA E INGLES",
  "SEGURIDAD Y SALUD EN EL TRABAJO",
  "ESPECIALIZACION EN GERENCIA DE PROYECTOS",
];

const initialForm = {
  documento: "",
  qr_uid: "",
  nombre: "",
  carrera: CAREERS[0],
  placa: "",
  color: "",
  vigencia: true,
};

function normalizePlate(value) {
  return (value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
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
    qr_uid: student.qr_uid || "",
    nombre: student.nombre || "",
    carrera: student.carrera || CAREERS[0],
    placa: normalizePlate(student.placa || ""),
    color: student.color || "",
    vigencia: Boolean(student.vigencia),
  };
}

export default function Estudiantes() {
  const { apiRequest, role, user } = useAuth();
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

  const canManageStudents = useMemo(() => ["ADMIN", "GUARDA"].includes(role), [role]);

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
      setStatus(`Estudiante ${data.nombre} cargado para ${canManageStudents ? "edicion" : "consulta"}.`);
    } catch (err) {
      setError(err.message);
      setScannedStudent(null);
      if (lookupMode === "documento") {
        setForm((current) => ({ ...current, documento: lookupValue.trim() }));
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

    if (!PLATE_REGEX.test(form.placa)) {
      setError("La placa debe tener formato ABC12D.");
      return;
    }

    setLoading(true);

    try {
      const isEditing = currentMode === "editar" && originalDocumento;
      const endpoint = isEditing
        ? `/estudiantes/documento/${encodeURIComponent(originalDocumento)}`
        : "/estudiantes/primer-ingreso";
      const method = isEditing ? "PUT" : "POST";
      const data = await apiRequest(endpoint, {
        method,
        body: JSON.stringify(form),
      });

      const estudiante = data.estudiante || data;
      const actionLabel = isEditing ? "actualizado" : "creado";

      setStatus(`Estudiante ${actionLabel} correctamente.`);
      setCurrentMode("editar");
      setOriginalDocumento(estudiante.documento || form.documento);
      setLookupMode("documento");
      setLookupValue(estudiante.documento || form.documento);
      setForm(mapStudentToForm(estudiante));
      setScannedStudent(estudiante);
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
      [field]: field === "placa" ? normalizePlate(value) : value,
    }));
  }

  function resetForm() {
    setForm(initialForm);
    setLookupValue("");
    setLookupMode("documento");
    setCurrentMode("crear");
    setOriginalDocumento("");
    setScannedStudent(null);
    setStatus("");
    setError("");
  }

  return (
    <section className="page">
      <header className="page__header">
        <p className="eyebrow">Estudiantes</p>
        <h2>{canManageStudents ? "Crear, buscar y actualizar estudiantes" : "Consulta de estudiantes"}</h2>
        <p>
          {canManageStudents
            ? "ADMIN y GUARDA pueden registrar estudiantes nuevos o cargarlos por documento/placa para actualizar sus datos."
            : "CONSULTA puede listar y buscar estudiantes, pero sin modificar registros."}
        </p>
      </header>

      <div className="cards-grid cards-grid--single">
        <article className="info-card">
          <h3>{currentMode === "editar" ? "Registro cargado" : "Registrar o buscar estudiante"}</h3>

          {canManageStudents ? (
            <div className="student-scan-block">
              <QrScanner
                title="Leer QR para primer ingreso"
                helpText="Escanea el QR del estudiante. Si ya existe en la base, cargaremos su informacion inmediatamente."
                buttonLabel="Escanear QR del estudiante"
                onScan={async (decodedText) => {
                  const qrValue = decodedText.trim();
                  const candidates = getQrCandidates(qrValue);
                  const matchedStudent = students.find((student) => candidates.includes(student.qr_uid));

                  handleChange("qr_uid", qrValue);
                  setError("");

                  if (matchedStudent) {
                    setForm(mapStudentToForm(matchedStudent));
                    setOriginalDocumento(matchedStudent.documento || "");
                    setCurrentMode("editar");
                    setScannedStudent(matchedStudent);
                    setLookupMode("documento");
                    setLookupValue(matchedStudent.documento || "");
                    setStatus(`QR reconocido. ${matchedStudent.nombre} cargado para edicion.`);
                    return;
                  }

                  setScannedStudent({
                    documento: "Sin registro",
                    nombre: "QR nuevo",
                    qr_uid: qrValue,
                    placa: "-",
                    carrera: "No encontrado en la base",
                    vigencia: false,
                  });
                  setStatus("QR cargado en el formulario. Completa los datos para registrar al estudiante.");
                }}
              />

              <div className="student-scan-result">
                <h4>Informacion del estudiante escaneado</h4>
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
                      <dt>Placa</dt>
                      <dd>{scannedStudent.placa || "-"}</dd>
                    </div>
                  </dl>
                ) : (
                  <div className="empty-state">Escanea un QR para ver aqui la informacion del estudiante.</div>
                )}
              </div>
            </div>
          ) : null}

          <form className="stack-form student-lookup-form" onSubmit={handleLookup}>
            <div className="search-mode-group" role="radiogroup" aria-label="Buscar por">
              <span className="search-mode-group__label">Buscar por:</span>
              <label className={`search-mode-option${lookupMode === "placa" ? " active" : ""}`}>
                <input
                  type="radio"
                  name="lookup-mode"
                  value="placa"
                  checked={lookupMode === "placa"}
                  onChange={(event) => setLookupMode(event.target.value)}
                />
                <span>Placa</span>
              </label>
              <label className={`search-mode-option${lookupMode === "documento" ? " active" : ""}`}>
                <input
                  type="radio"
                  name="lookup-mode"
                  value="documento"
                  checked={lookupMode === "documento"}
                  onChange={(event) => setLookupMode(event.target.value)}
                />
                <span>Documento</span>
              </label>
            </div>

            <input
              className="lookup-input"
              type="text"
              placeholder={lookupMode === "documento" ? "Ingresa el documento del estudiante" : "Ingresa la placa. Ejemplo: ABC12D"}
              value={lookupValue}
              onChange={(event) => setLookupValue(lookupMode === "placa" ? normalizePlate(event.target.value) : event.target.value)}
            />
            <div className="button-strip">
              <button type="submit" disabled={loading}>
                {loading ? "Buscando..." : "Buscar"}
              </button>
            </div>
          </form>

          <form className="stack-form" onSubmit={handleSubmit}>
            <div className="form-grid-2">
              <label>
                Documento
                <input
                  type="text"
                  value={form.documento}
                  onChange={(event) => handleChange("documento", event.target.value)}
                  required
                  disabled={!canManageStudents}
                />
              </label>

              <label>
                QR UID
                <input
                  type="text"
                  value={form.qr_uid}
                  onChange={(event) => handleChange("qr_uid", event.target.value)}
                  required
                  disabled={!canManageStudents}
                />
              </label>

              <label>
                Nombre
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(event) => handleChange("nombre", event.target.value)}
                  required
                  disabled={!canManageStudents}
                />
              </label>

              <label>
                Carrera
                <select
                  value={form.carrera}
                  onChange={(event) => handleChange("carrera", event.target.value)}
                  disabled={!canManageStudents}
                >
                  {CAREERS.map((career) => (
                    <option key={career} value={career}>
                      {career}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Placa
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
                {showStudentsTable ? "Ocultar estudiantes" : "Ver estudiantes"}
              </button>
            </div>
          </form>

          {status ? <div className="form-success">{status}</div> : null}
          {error ? <div className="form-error">{error}</div> : null}
        </article>

        <article className="info-card">
          <h3>Estudiantes registrados</h3>
          {!showStudentsTable ? (
            <div className="empty-state">La tabla esta oculta. Usa el boton "Ver estudiantes" para cargarla en pantalla.</div>
          ) : students.length === 0 ? (
            <div className="empty-state">Aun no hay estudiantes registrados.</div>
          ) : (
            <div className="table-wrap table-wrap--scrollable">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Documento</th>
                    <th>Nombre</th>
                    <th>QR</th>
                    <th>Placa</th>
                    <th>Vigencia</th>
                    <th>Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student.estudiante_id}>
                      <td>{student.documento}</td>
                      <td>{student.nombre}</td>
                      <td>{student.qr_uid}</td>
                      <td>{student.placa || "-"}</td>
                      <td>{student.vigencia ? "Vigente" : "No vigente"}</td>
                      <td>{student.usuario || student.actor_username || user?.username || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
