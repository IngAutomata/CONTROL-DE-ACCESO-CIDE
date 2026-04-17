import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import QrScanner from "../components/QrScanner.jsx";
import VisitantesMovimientos from "../components/VisitantesMovimientos.jsx";

const CIDE_QR_REGEX = /^https:\/\/soe\.cide\.edu\.co\/verificar-estudiante\/[A-Za-z0-9]{1,8}$/;
const DOCUMENT_REGEX = /^\d{8,10}$/;
const NOVEDAD_MOTIVOS = [
  "Veh\u00edculo alterno del estudiante",
  "Moto principal en mantenimiento",
  "Uso ocasional autorizado",
  "Otro",
];

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${date.toLocaleDateString("es-CO")} ${date.toLocaleTimeString("es-CO")}`;
}

export default function Movimientos() {
  const { role, apiRequest } = useAuth();
  const [movementView, setMovementView] = useState("estudiantes");
  const [insideCampus, setInsideCampus] = useState([]);
  const [allMovements, setAllMovements] = useState([]);
  const [registerMode, setRegisterMode] = useState("qr");
  const [form, setForm] = useState({
    qr_uid: "",
    documento: "",
    placa: "",
    vehiculo_documento: "",
    registrar_novedad: false,
    novedad_motivo: NOVEDAD_MOTIVOS[0],
    novedad_soporte: "TARJETA_PROPIEDAD",
    novedad_confirmada: false,
    novedad_observaciones: "",
  });
  const [documentStudent, setDocumentStudent] = useState(null);
  const [documentVehicleChoice, setDocumentVehicleChoice] = useState("");
  const [documentLookupError, setDocumentLookupError] = useState("");
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [lastRegistered, setLastRegistered] = useState(null);
  const canRegister = role === "ADMIN" || role === "GUARDA";
  const currentInsideRecord = documentStudent
    ? insideCampus.find((item) => String(item.documento) === String(documentStudent.documento))
    : null;
  const currentInsidePlate = currentInsideRecord?.placa || "";
  const currentInsidePlateIsRegistered =
    Boolean(currentInsidePlate) &&
    [documentStudent?.placa, documentStudent?.placa_secundaria]
      .filter(Boolean)
      .some((plate) => plate === currentInsidePlate);
  const isDocumentExitFlow = Boolean(currentInsideRecord);
  const currentInsidePlateLabel = currentInsidePlate === documentStudent?.placa
    ? "Moto principal con la que ingresó"
    : currentInsidePlate === documentStudent?.placa_secundaria
      ? "Moto secundaria con la que ingresó"
      : "Moto actualmente dentro";

  const loadStudentByDocument = useCallback(async (documento, { preserveChoice = false } = {}) => {
    if (!DOCUMENT_REGEX.test(documento)) {
      setDocumentStudent(null);
      setDocumentVehicleChoice("");
      setDocumentLookupError("");
      return null;
    }

    try {
      const data = await apiRequest(`/estudiantes/documento/${encodeURIComponent(documento)}`);
      const estudiante = data.estudiante || data || null;
      setDocumentStudent(estudiante);
      setDocumentLookupError("");
      if (!preserveChoice) {
        setDocumentVehicleChoice("");
      }
      return estudiante;
    } catch (err) {
      setDocumentStudent(null);
      setDocumentLookupError(err.message || "No fue posible consultar al estudiante.");
      if (!preserveChoice) {
        setDocumentVehicleChoice("");
      }
      return null;
    }
  }, [apiRequest]);

  const refreshData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setError("");
    }

    const payloads = await Promise.all([
      apiRequest("/movimientos/dentro-campus"),
      apiRequest("/movimientos"),
    ]);

    setInsideCampus(payloads[0].estudiantes || []);
    setAllMovements(payloads[1].movimientos || []);
  }, [apiRequest]);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        await refreshData();
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [refreshData, role]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      refreshData({ silent: true }).catch(() => null);
    }, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, [refreshData]);

  useEffect(() => {
    if (registerMode !== "documento") {
      setDocumentStudent(null);
      setDocumentVehicleChoice("");
      setDocumentLookupError("");
      setDocumentModalOpen(false);
      return undefined;
    }

    if (!DOCUMENT_REGEX.test(form.documento)) {
      setDocumentStudent(null);
      setDocumentVehicleChoice("");
      setDocumentLookupError("");
      setDocumentModalOpen(false);
      return undefined;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      try {
        const estudiante = await loadStudentByDocument(form.documento);
        if (cancelled || !estudiante) return;
      } catch (_) {
        if (cancelled) return;
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [form.documento, loadStudentByDocument, registerMode]);

  useEffect(() => {
    if (!documentModalOpen) {
      return;
    }

    if (isDocumentExitFlow && currentInsidePlate) {
      setDocumentVehicleChoice(currentInsidePlate);
      return;
    }

    if (!isDocumentExitFlow && documentVehicleChoice === currentInsidePlate) {
      setDocumentVehicleChoice("");
    }
  }, [currentInsidePlate, documentModalOpen, documentVehicleChoice, isDocumentExitFlow]);

  async function registerMovement(payload) {
    if (payload.qr_uid && !CIDE_QR_REGEX.test((payload.qr_uid || "").trim())) {
      throw new Error("El QR debe tener formato CIDE y terminar en un c\u00f3digo alfanum\u00e9rico de 1 a 8 caracteres.");
    }

    if (payload.documento && !DOCUMENT_REGEX.test((payload.documento || "").trim())) {
      throw new Error("La c\u00e9dula debe tener entre 8 y 10 d\u00edgitos num\u00e9ricos.");
    }

    const data = await apiRequest("/movimientos/registrar", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    setStatus(`${data.movimiento.tipo} registrada para ${data.estudiante.nombre}`);
    setLastRegistered({
      tipo: data.movimiento.tipo,
      nombre: data.estudiante.nombre,
      documento: data.estudiante.documento,
      placa: data.novedad?.placa_observada || data.movimiento.vehiculo_placa || data.estudiante.placa || "-",
      fecha: data.movimiento.fecha_hora,
      qr_uid: payload.qr_uid || data.estudiante.qr_uid || "-",
      actor: data.movimiento.actor_username || data.estudiante.updated_by_username || "Sin responsable",
      novedad: data.novedad || null,
    });
    setForm({
      qr_uid: "",
      documento: "",
      placa: "",
      vehiculo_documento: "",
      registrar_novedad: false,
      novedad_motivo: NOVEDAD_MOTIVOS[0],
      novedad_soporte: "TARJETA_PROPIEDAD",
      novedad_confirmada: false,
      novedad_observaciones: "",
    });
    setDocumentStudent(null);
    setDocumentVehicleChoice("");
    setDocumentLookupError("");
    setDocumentModalOpen(false);
    await refreshData();
    return data;
  }

  function buildDocumentPayload(resolvedStudent) {
    if (!resolvedStudent) {
      throw new Error("Primero debes consultar una cédula válida para identificar al estudiante.");
    }

    if (!documentVehicleChoice) {
      throw new Error("Debes indicar con cuál moto ingresa el estudiante.");
    }

    if (documentVehicleChoice === "OTRA") {
      if (!form.placa.trim()) {
        throw new Error("Debes registrar la placa observada para la moto no registrada.");
      }

      if (!form.novedad_confirmada) {
        throw new Error("Debes confirmar que validaste la tarjeta de propiedad o el soporte en RUNT.");
      }

      if (form.novedad_motivo === "Otro" && !form.novedad_observaciones.trim()) {
        throw new Error("Debes agregar una observación cuando eliges el motivo 'Otro'.");
      }

      return {
        documento: form.documento.trim(),
        placa: form.placa.trim().toUpperCase(),
        novedad: {
          motivo: form.novedad_motivo,
          tipo_soporte: form.novedad_soporte,
          soporte_validado: form.novedad_confirmada,
          observaciones: form.novedad_observaciones.trim(),
        },
      };
    }

    return {
      documento: form.documento.trim(),
      placa: documentVehicleChoice,
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setStatus("");

    if (!canRegister) {
      setError("Tu rol solo permite consultar movimientos.");
      return;
    }

    try {
      let payload;
      if (registerMode === "qr") {
        payload = { qr_uid: form.qr_uid.trim() };
      } else if (registerMode === "documento") {
        const resolvedStudent = documentStudent || await loadStudentByDocument(form.documento, { preserveChoice: true });

        if (!resolvedStudent) {
          throw new Error("Primero debes consultar una cédula válida para identificar al estudiante.");
        }
        if (currentInsideRecord?.placa) {
          setDocumentVehicleChoice(currentInsideRecord.placa);
        }
        setDocumentModalOpen(true);
        return;
      } else if (form.registrar_novedad) {
        if (!DOCUMENT_REGEX.test(form.vehiculo_documento.trim())) {
          throw new Error("La c\u00e9dula del estudiante debe tener entre 8 y 10 d\u00edgitos num\u00e9ricos.");
        }

        if (!form.novedad_confirmada) {
          throw new Error("Debes confirmar que validaste la tarjeta de propiedad o el soporte en RUNT.");
        }

        if (form.novedad_motivo === "Otro" && !form.novedad_observaciones.trim()) {
          throw new Error("Debes agregar una observaci\u00f3n cuando eliges el motivo 'Otro'.");
        }

        payload = {
          documento: form.vehiculo_documento.trim(),
          placa: form.placa.trim().toUpperCase(),
          novedad: {
            motivo: form.novedad_motivo,
            tipo_soporte: form.novedad_soporte,
            soporte_validado: form.novedad_confirmada,
            observaciones: form.novedad_observaciones.trim(),
          },
        };
      } else {
        payload = { placa: form.placa.trim().toUpperCase() };
      }

      await registerMovement(payload);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDocumentModalConfirm() {
    setError("");
    setStatus("");

    try {
      const resolvedStudent = documentStudent || await loadStudentByDocument(form.documento, { preserveChoice: true });
      const payload = buildDocumentPayload(resolvedStudent);
      await registerMovement(payload);
    } catch (err) {
      setError(err.message);
      return;
    }

    setDocumentModalOpen(false);
  }

  return (
    <section className="page">
      <header className="page__header">
        <p className="eyebrow">Movimientos</p>
        <h2>{"Operación según permisos"}</h2>
        <p>
          {role === "ADMIN"
            ? "Como ADMIN puedes registrar movimientos y revisar el hist\u00f3rico completo."
            : role === "GUARDA"
              ? "Como GUARDA puedes registrar entradas y salidas, y ver qui\u00e9nes est\u00e1n dentro del campus."
              : "Como CONSULTA puedes revisar el estado actual del campus y el historial sin modificar datos."}
        </p>
      </header>

      <div className="admin-view-tabs" role="tablist" aria-label="Tipos de operación">
        <button
          type="button"
          role="tab"
          aria-selected={movementView === "estudiantes"}
          className={movementView === "estudiantes" ? "admin-view-tab is-active" : "admin-view-tab"}
          onClick={() => setMovementView("estudiantes")}
        >
          Estudiantes
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={movementView === "visitantes"}
          className={movementView === "visitantes" ? "admin-view-tab is-active" : "admin-view-tab"}
          onClick={() => setMovementView("visitantes")}
        >
          Visitantes
        </button>
      </div>

      {movementView === "estudiantes" ? (
      <>
      {canRegister && (
        <div className="cards-grid cards-grid--wide-main movement-grid">
          <article className="info-card movement-register-card">
            <div className="movement-register-head">
              <div>
                <p className="eyebrow">Acceso en tiempo real</p>
                <h3>Registrar entrada o salida</h3>
                <p className="movement-copy">
                  Puedes registrar por QR, por cédula o por placa. El sistema decide automáticamente si corresponde ENTRADA o SALIDA según el último movimiento registrado del estudiante encontrado.
                </p>
              </div>
              <div className="movement-mode-badge">Modo {role}</div>
            </div>

            <form className="inline-form" onSubmit={handleSubmit}>
              <select value={registerMode} onChange={(event) => setRegisterMode(event.target.value)}>
                <option value="qr">Registrar por QR</option>
                <option value="documento">Registrar por cédula</option>
                <option value="placa">Registrar por placa</option>
              </select>
              {registerMode === "qr" ? (
                <input
                  type="text"
                  placeholder="https://soe.cide.edu.co/verificar-estudiante/NjEyMzE2"
                  value={form.qr_uid}
                  onChange={(event) => setForm((current) => ({ ...current, qr_uid: event.target.value.trim() }))}
                  required
                />
              ) : registerMode === "documento" ? (
                <div className="stack-form">
                  <input
                    type="text"
                    placeholder={"Cédula de 8 a 10 dígitos"}
                    inputMode="numeric"
                    maxLength={10}
                    value={form.documento}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        documento: event.target.value.replace(/\D/g, "").slice(0, 10),
                        placa: "",
                        novedad_confirmada: false,
                        novedad_observaciones: "",
                        novedad_motivo: NOVEDAD_MOTIVOS[0],
                        novedad_soporte: "TARJETA_PROPIEDAD",
                      }))
                    }
                    required
                  />
                  <div className="empty-state">
                    {"Al pulsar Registrar se abrirá un popup para escoger la moto que entra o sale con esa cédula."}
                  </div>
                  {documentLookupError ? <div className="form-error">{documentLookupError}</div> : null}
                </div>
              ) : (
                <div className="stack-form">
                  <input
                    type="text"
                    placeholder="Placa ABC12D"
                    maxLength={6}
                    value={form.placa}
                    onChange={(event) => setForm((current) => ({ ...current, placa: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) }))}
                    required
                  />
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={form.registrar_novedad}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, registrar_novedad: event.target.checked }))
                      }
                    />
                    <span>{"Registrar ingreso con novedad si la moto no está registrada"}</span>
                  </label>
                  {form.registrar_novedad ? (
                    <div className="form-grid-2">
                      <label>
                        Documento del estudiante
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={10}
                          value={form.vehiculo_documento}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              vehiculo_documento: event.target.value.replace(/\D/g, "").slice(0, 10),
                            }))
                          }
                          placeholder={"Cédula del estudiante"}
                          required
                        />
                      </label>
                      <label>
                        Motivo
                        <select
                          value={form.novedad_motivo}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, novedad_motivo: event.target.value }))
                          }
                        >
                          {NOVEDAD_MOTIVOS.map((motivo) => (
                            <option key={motivo} value={motivo}>
                              {motivo}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Soporte validado con
                        <select
                          value={form.novedad_soporte}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, novedad_soporte: event.target.value }))
                          }
                        >
                          <option value="TARJETA_PROPIEDAD">Tarjeta de propiedad</option>
                          <option value="RUNT">RUNT</option>
                        </select>
                      </label>
                      <label>
                        Observaciones
                        <input
                          type="text"
                          value={form.novedad_observaciones}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, novedad_observaciones: event.target.value }))
                          }
                          placeholder="Detalle adicional si aplica"
                        />
                      </label>
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={form.novedad_confirmada}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, novedad_confirmada: event.target.checked }))
                          }
                        />
                        <span>{"Confirmo que el estudiante presentó tarjeta de propiedad o soporte en RUNT"}</span>
                      </label>
                    </div>
                  ) : null}
                </div>
              )}
              <button type="submit">Registrar</button>
            </form>
            {registerMode === "qr" ? (
              <QrScanner
                title="Escanear QR para acceso"
                helpText={"Al detectar un QR válido, el sistema registrará automáticamente ENTRADA o SALIDA según el último movimiento del estudiante."}
                buttonLabel={"Abrir cámara para acceso"}
                onScan={async (decodedText) => {
                  setError("");
                  setStatus("QR detectado. Registrando movimiento...");
                  await registerMovement({ qr_uid: decodedText.trim() });
                }}
              />
            ) : null}
            {status ? <div className="form-success">{status}</div> : null}
          </article>

          <article className="info-card movement-last-card">
            <p className="eyebrow">{"Última lectura"}</p>
            <h3>Resultado del escaneo</h3>
            {lastRegistered ? (
              <div className="scan-result">
                <span className={`movement-pill ${lastRegistered.tipo === "ENTRADA" ? "entry" : "exit"}`}>
                  {lastRegistered.tipo}
                </span>
                <strong className="scan-result__name">{lastRegistered.nombre}</strong>
                <div className="scan-result__meta">
                  <span>Documento: {lastRegistered.documento}</span>
                  <span>Placa: {lastRegistered.placa}</span>
                  <span>QR: {lastRegistered.qr_uid}</span>
                  <span>Hora: {formatDate(lastRegistered.fecha)}</span>
                  <span>Responsable: {lastRegistered.actor}</span>
                  {lastRegistered.novedad ? (
                    <span>
                      {"Novedad: "}{lastRegistered.novedad.motivo} {"·"} {lastRegistered.novedad.tipo_soporte}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="empty-state">
                {"Aún no hay una lectura reciente en esta sesión. Escanea un QR o registra por cédula o placa para ver aquí el último acceso procesado."}
              </div>
            )}
          </article>
        </div>
      )}

      {error ? <div className="form-error">{error}</div> : null}

      {documentModalOpen && documentStudent ? (
        <div className="modal" aria-hidden="false">
          <div className="modal-backdrop" onClick={() => setDocumentModalOpen(false)} />
          <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="movement-document-modal-title">
            <p className="eyebrow">Selección de moto</p>
            <h3 id="movement-document-modal-title">Confirmar ingreso o salida por cédula</h3>
            <p className="modal-copy">
              {isDocumentExitFlow
                ? `Estudiante: ${documentStudent.nombre} · Documento ${documentStudent.documento}. Como ya está dentro del campus, solo puedes registrar la salida con la misma moto con la que ingresó.`
                : `Estudiante: ${documentStudent.nombre} · Documento ${documentStudent.documento}. Selecciona con cuál moto se está moviendo dentro del campus.`}
            </p>
            <div className="movement-choice-grid">
              {!isDocumentExitFlow && documentStudent.placa ? (
                <label className={`movement-choice-card ${documentVehicleChoice === documentStudent.placa ? "active" : ""}`}>
                  <input
                    type="radio"
                    name="document-vehicle-choice"
                    value={documentStudent.placa}
                    checked={documentVehicleChoice === documentStudent.placa}
                    onChange={(event) => {
                      const value = event.target.value;
                      setDocumentVehicleChoice(value);
                      setForm((current) => ({
                        ...current,
                        placa: "",
                        novedad_confirmada: false,
                        novedad_observaciones: "",
                        novedad_motivo: NOVEDAD_MOTIVOS[0],
                        novedad_soporte: "TARJETA_PROPIEDAD",
                      }));
                    }}
                  />
                  <span className="movement-choice-title">Moto principal</span>
                  <span>{documentStudent.placa}</span>
                  <span>{documentStudent.color || "Sin color registrado"}</span>
                </label>
              ) : null}
              {!isDocumentExitFlow && documentStudent.placa_secundaria ? (
                <label className={`movement-choice-card ${documentVehicleChoice === documentStudent.placa_secundaria ? "active" : ""}`}>
                  <input
                    type="radio"
                    name="document-vehicle-choice"
                    value={documentStudent.placa_secundaria}
                    checked={documentVehicleChoice === documentStudent.placa_secundaria}
                    onChange={(event) => {
                      const value = event.target.value;
                      setDocumentVehicleChoice(value);
                      setForm((current) => ({
                        ...current,
                        placa: "",
                        novedad_confirmada: false,
                        novedad_observaciones: "",
                        novedad_motivo: NOVEDAD_MOTIVOS[0],
                        novedad_soporte: "TARJETA_PROPIEDAD",
                      }));
                    }}
                  />
                  <span className="movement-choice-title">Moto secundaria</span>
                  <span>{documentStudent.placa_secundaria}</span>
                  <span>{documentStudent.color_secundaria || "Sin color registrado"}</span>
                </label>
              ) : null}
              {!isDocumentExitFlow ? (
              <label className={`movement-choice-card ${documentVehicleChoice === "OTRA" ? "active" : ""}`}>
                <input
                  type="radio"
                  name="document-vehicle-choice"
                  value="OTRA"
                  checked={documentVehicleChoice === "OTRA"}
                  onChange={(event) => {
                    const value = event.target.value;
                    setDocumentVehicleChoice(value);
                    setForm((current) => ({
                      ...current,
                      placa: current.placa,
                      novedad_confirmada: current.novedad_confirmada,
                      novedad_observaciones: current.novedad_observaciones,
                      novedad_motivo: current.novedad_motivo,
                      novedad_soporte: current.novedad_soporte,
                    }));
                  }}
                />
                <span className="movement-choice-title">Otra moto no registrada</span>
                <span>{"Se registrará con novedad y validación manual."}</span>
              </label>
              ) : null}
              {currentInsidePlate ? (
                <label className={`movement-choice-card ${documentVehicleChoice === currentInsidePlate ? "active" : ""}`}>
                  <input
                    type="radio"
                    name="document-vehicle-choice"
                    value={currentInsidePlate}
                    checked={documentVehicleChoice === currentInsidePlate}
                    onChange={(event) => {
                      const value = event.target.value;
                      setDocumentVehicleChoice(value);
                      setForm((current) => ({
                        ...current,
                        placa: "",
                        novedad_confirmada: false,
                        novedad_observaciones: "",
                        novedad_motivo: NOVEDAD_MOTIVOS[0],
                        novedad_soporte: "TARJETA_PROPIEDAD",
                      }));
                    }}
                  />
                  <span className="movement-choice-title">{currentInsidePlateIsRegistered ? currentInsidePlateLabel : "Moto actualmente dentro"}</span>
                  <span>{currentInsidePlate}</span>
                  <span>{currentInsideRecord?.novedad_motivo ? `Ingreso con novedad: ${currentInsideRecord.novedad_motivo}` : "Registrada en el último ingreso"}</span>
                </label>
              ) : null}
            </div>
            {isDocumentExitFlow ? (
              <div className="empty-state">
                {"La salida se registra únicamente con la placa del último ingreso para evitar inconsistencias en el control del campus."}
              </div>
            ) : null}
            {documentVehicleChoice === "OTRA" && !isDocumentExitFlow ? (
              <div className="form-grid-2 movement-modal-form">
                <label>
                  Placa observada
                  <input
                    type="text"
                    placeholder="Placa ABC12D"
                    maxLength={6}
                    value={form.placa}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        placa: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6),
                      }))
                    }
                  />
                </label>
                <label>
                  Motivo
                  <select
                    value={form.novedad_motivo}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, novedad_motivo: event.target.value }))
                    }
                  >
                    {NOVEDAD_MOTIVOS.map((motivo) => (
                      <option key={motivo} value={motivo}>
                        {motivo}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Soporte validado con
                  <select
                    value={form.novedad_soporte}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, novedad_soporte: event.target.value }))
                    }
                  >
                    <option value="TARJETA_PROPIEDAD">Tarjeta de propiedad</option>
                    <option value="RUNT">RUNT</option>
                  </select>
                </label>
                <label>
                  Observaciones
                  <input
                    type="text"
                    value={form.novedad_observaciones}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, novedad_observaciones: event.target.value }))
                    }
                    placeholder="Detalle adicional si aplica"
                  />
                </label>
                <label className="checkbox-row movement-modal-checkbox">
                  <input
                    type="checkbox"
                    checked={form.novedad_confirmada}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, novedad_confirmada: event.target.checked }))
                    }
                  />
                  <span>{"Confirmo que el estudiante presentó tarjeta de propiedad o soporte en RUNT"}</span>
                </label>
              </div>
            ) : null}
            <div className="button-strip">
              <button type="button" className="ghost-button" onClick={() => setDocumentModalOpen(false)}>
                Cancelar
              </button>
              <button type="button" onClick={handleDocumentModalConfirm}>
                Confirmar movimiento
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="cards-grid cards-grid--single">
        <article className="info-card">
          <div className="table-head">
            <div>
              <p className="eyebrow">Presencia activa</p>
              <h3>Dentro del campus</h3>
            </div>
            <span className="table-count">{insideCampus.length} visible(s)</span>
          </div>
          {insideCampus.length === 0 ? (
            <div className="empty-state">No hay estudiantes dentro del campus en este momento.</div>
          ) : (
            <div className="table-wrap table-wrap--scrollable">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Estudiante</th>
                    <th>Placa</th>
                    <th>Responsable</th>
                    <th>Novedad</th>
                    <th>{"Último movimiento"}</th>
                  </tr>
                </thead>
                <tbody>
                  {insideCampus.map((item) => (
                    <tr key={`${item.estudiante_id}-${item.documento}`}>
                      <td>
                        <div className="movement-cell-strong">
                          <span className="movement-main">{item.nombre}</span>
                          <span className="movement-sub">DOC {item.documento}</span>
                        </div>
                      </td>
                      <td><span className="plate-chip">{item.placa || "-"}</span></td>
                      <td>{item.actor_username || "Sin responsable"}</td>
                      <td>{item.novedad_motivo || "-"}</td>
                      <td><span className="movement-time">{formatDate(item.fecha_ultimo_movimiento)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="info-card">
          <div className="table-head">
            <div>
              <p className="eyebrow">Actividad reciente</p>
              <h3>{"Histórico de movimientos"}</h3>
            </div>
            <span className="table-count">{allMovements.length} evento(s)</span>
          </div>
          {allMovements.length === 0 ? (
            <div className="empty-state">{"Aún no hay movimientos registrados."}</div>
          ) : (
            <div className="table-wrap table-wrap--scrollable">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Estudiante</th>
                    <th>Tipo</th>
                    <th>Placa</th>
                    <th>Responsable</th>
                    <th>Novedad</th>
                  </tr>
                </thead>
                <tbody>
                  {allMovements.map((item) => (
                    <tr key={item.id}>
                      <td><span className="movement-time">{formatDate(item.fecha_hora)}</span></td>
                      <td>
                        <div className="movement-cell-strong">
                          <span className="movement-main">{item.nombre}</span>
                          <span className="movement-sub">DOC {item.documento} {"·"} Movimiento #{item.id}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`movement-pill ${item.tipo === "ENTRADA" ? "entry" : "exit"}`}>
                          {item.tipo}
                        </span>
                      </td>
                      <td><span className="plate-chip">{item.placa || "-"}</span></td>
                      <td>{item.actor_username || "Sin responsable"}</td>
                      <td>{item.novedad_motivo ? `${item.novedad_motivo} · ${item.placa || "-"}` : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </div>
      </>
      ) : (
        <VisitantesMovimientos />
      )}
    </section>
  );
}





