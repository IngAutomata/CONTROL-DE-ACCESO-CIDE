import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import QrScanner from "../components/QrScanner.jsx";

const CIDE_QR_REGEX = /^https:\/\/soe\.cide\.edu\.co\/verificar-estudiante\/[A-Za-z0-9]{1,8}$/;
const DOCUMENT_REGEX = /^\d{8,10}$/;

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${date.toLocaleDateString("es-CO")} ${date.toLocaleTimeString("es-CO")}`;
}

export default function Movimientos() {
  const { role, apiRequest } = useAuth();
  const [insideCampus, setInsideCampus] = useState([]);
  const [allMovements, setAllMovements] = useState([]);
  const [registerMode, setRegisterMode] = useState("qr");
  const [form, setForm] = useState({ qr_uid: "", documento: "", placa: "" });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [lastRegistered, setLastRegistered] = useState(null);
  const canRegister = role === "ADMIN" || role === "GUARDA";

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
      placa: data.estudiante.placa || "-",
      fecha: data.movimiento.fecha_hora,
      qr_uid: payload.qr_uid || data.estudiante.qr_uid || "-",
      actor: data.movimiento.actor_username || data.estudiante.updated_by_username || "Sin responsable",
    });
    setForm({ qr_uid: "", documento: "", placa: "" });
    await refreshData();
    return data;
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
      const payload = registerMode === "qr"
        ? { qr_uid: form.qr_uid.trim() }
        : registerMode === "documento"
          ? { documento: form.documento.trim() }
          : { placa: form.placa.trim().toUpperCase() };

      await registerMovement(payload);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="page">
      <header className="page__header">
        <p className="eyebrow">Movimientos</p>
        <h2>{"Operaci\u00f3n seg\u00fan permisos"}</h2>
        <p>
          {role === "ADMIN"
            ? "Como ADMIN puedes registrar movimientos y revisar el hist\u00f3rico completo."
            : role === "GUARDA"
              ? "Como GUARDA puedes registrar entradas y salidas, y ver qui\u00e9nes est\u00e1n dentro del campus."
              : "Como CONSULTA puedes revisar el estado actual del campus y el historial sin modificar datos."}
        </p>
      </header>

      {canRegister && (
        <div className="cards-grid cards-grid--wide-main movement-grid">
          <article className="info-card movement-register-card">
            <div className="movement-register-head">
              <div>
                <p className="eyebrow">Acceso en tiempo real</p>
                <h3>Registrar entrada o salida</h3>
                <p className="movement-copy">
                  {"Puedes registrar por QR, por c\u00e9dula o por placa. El sistema decide autom\u00e1ticamente si corresponde "}
                  ENTRADA o SALIDA{" seg\u00fan el \u00faltimo movimiento registrado del estudiante encontrado."}
                </p>
              </div>
              <div className="movement-mode-badge">Modo {role}</div>
            </div>

            <form className="inline-form" onSubmit={handleSubmit}>
              <select value={registerMode} onChange={(event) => setRegisterMode(event.target.value)}>
                <option value="qr">Registrar por QR</option>
                <option value="documento">{"Registrar por c\u00e9dula"}</option>
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
                <input
                  type="text"
                  placeholder={"C\u00e9dula de 8 a 10 d\u00edgitos"}
                  inputMode="numeric"
                  maxLength={10}
                  value={form.documento}
                  onChange={(event) => setForm((current) => ({ ...current, documento: event.target.value.replace(/\D/g, "").slice(0, 10) }))}
                  required
                />
              ) : (
                <input
                  type="text"
                  placeholder="Placa ABC12D"
                  maxLength={6}
                  value={form.placa}
                  onChange={(event) => setForm((current) => ({ ...current, placa: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) }))}
                  required
                />
              )}
              <button type="submit">Registrar</button>
            </form>
            {registerMode === "qr" ? (
              <QrScanner
                title="Escanear QR para acceso"
                helpText={"Al detectar un QR v\u00e1lido, el sistema registrar\u00e1 autom\u00e1ticamente ENTRADA o SALIDA seg\u00fan el \u00faltimo movimiento del estudiante."}
                buttonLabel={"Abrir c\u00e1mara para acceso"}
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
            <p className="eyebrow">{"\u00daltima lectura"}</p>
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
                </div>
              </div>
            ) : (
              <div className="empty-state">
                {"A\u00fan no hay una lectura reciente en esta sesi\u00f3n. Escanea un QR o registra por c\u00e9dula/placa para ver aqu\u00ed el \u00faltimo acceso procesado."}
              </div>
            )}
          </article>
        </div>
      )}

      {error ? <div className="form-error">{error}</div> : null}

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
                    <th>{"\u00daltimo movimiento"}</th>
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
              <h3>{"Hist\u00f3rico de movimientos"}</h3>
            </div>
            <span className="table-count">{allMovements.length} evento(s)</span>
          </div>
          {allMovements.length === 0 ? (
            <div className="empty-state">{"A\u00fan no hay movimientos registrados."}</div>
          ) : (
            <div className="table-wrap table-wrap--scrollable">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Estudiante</th>
                    <th>Tipo</th>
                    <th>Responsable</th>
                  </tr>
                </thead>
                <tbody>
                  {allMovements.map((item) => (
                    <tr key={item.id}>
                      <td><span className="movement-time">{formatDate(item.fecha_hora)}</span></td>
                      <td>
                        <div className="movement-cell-strong">
                          <span className="movement-main">{item.nombre}</span>
                          <span className="movement-sub">DOC {item.documento} - Movimiento #{item.id}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`movement-pill ${item.tipo === "ENTRADA" ? "entry" : "exit"}`}>
                          {item.tipo}
                        </span>
                      </td>
                      <td>{item.actor_username || "Sin responsable"}</td>
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
