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
      setStatus(`Estudiante ${data.nombre} cargado para ${canManageStudents ? "edicion" : "consulta"}.`);
    } catch (err) {
      setError(err.message);
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

          <form className="inline-form" onSubmit={handleLookup}>
            <select value={lookupMode} onChange={(event) => setLookupMode(event.target.value)}>
              <option value="documento">Buscar por documento</option>
              <option value="placa">Buscar por placa</option>
            </select>

            <input
              type="text"
              placeholder={lookupMode === "documento" ? "Documento" : "Placa ABC12D"}
              value={lookupValue}
              onChange={(event) => setLookupValue(lookupMode === "placa" ? normalizePlate(event.target.value) : event.target.value)}
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
            </div>
          </form>

          {canManageStudents ? (
            <QrScanner
              title="Leer QR para primer ingreso"
              helpText="Escanea el QR real del estudiante para llenar automaticamente el campo qr_uid antes de guardar."
              buttonLabel="Escanear QR del estudiante"
              onScan={async (decodedText) => {
                handleChange("qr_uid", decodedText.trim());
                setStatus("QR cargado en el formulario. Ahora puedes completar o guardar el registro.");
                setError("");
              }}
            />
          ) : null}

          {status ? <div className="form-success">{status}</div> : null}
          {error ? <div className="form-error">{error}</div> : null}
        </article>

        <article className="info-card">
          <h3>Estudiantes registrados</h3>
          {students.length === 0 ? (
            <div className="empty-state">Aun no hay estudiantes registrados.</div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Documento</th>
                    <th>Nombre</th>
                    <th>QR</th>
                    <th>Placa</th>
                    <th>Vigencia</th>
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
