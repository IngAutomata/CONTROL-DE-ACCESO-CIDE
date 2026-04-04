import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import QrScanner from "../components/QrScanner.jsx";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${date.toLocaleDateString("es-CO")} ${date.toLocaleTimeString("es-CO")}`;
}

export default function Movimientos() {
  const { role, apiRequest, user } = useAuth();
  const [insideCampus, setInsideCampus] = useState([]);
  const [allMovements, setAllMovements] = useState([]);
  const [form, setForm] = useState({ qr_uid: "" });
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

  async function registerMovement(qrValue) {
    const data = await apiRequest("/movimientos/registrar", {
      method: "POST",
      body: JSON.stringify({ qr_uid: qrValue }),
    });

    setStatus(`${data.movimiento.tipo} registrada para ${data.estudiante.nombre}`);
    setLastRegistered({
      tipo: data.movimiento.tipo,
      nombre: data.estudiante.nombre,
      documento: data.estudiante.documento,
      placa: data.estudiante.placa || "-",
      fecha: data.movimiento.fecha_hora,
      qr_uid: qrValue,
    });
    setForm({ qr_uid: "" });
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
      await registerMovement(form.qr_uid);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="page">
      <header className="page__header">
        <p className="eyebrow">Movimientos</p>
        <h2>Operacion segun permisos</h2>
        <p>
          {role === "ADMIN"
            ? "Como ADMIN puedes registrar movimientos y revisar el historico completo."
            : role === "GUARDA"
              ? "Como GUARDA puedes registrar entradas/salidas y ver quienes estan dentro del campus."
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
                  Puedes usar el QR UID manual o activar la camara del equipo. El sistema decide automaticamente si corresponde
                  ENTRADA o SALIDA segun el ultimo movimiento registrado.
                </p>
              </div>
              <div className="movement-mode-badge">Modo {role}</div>
            </div>

            <form className="inline-form" onSubmit={handleSubmit}>
              <input
                type="text"
                placeholder="QR UID"
                value={form.qr_uid}
                onChange={(event) => setForm({ qr_uid: event.target.value })}
                required
              />
              <button type="submit">Registrar</button>
            </form>
            <QrScanner
              title="Escanear QR para acceso"
              helpText="Al detectar un QR valido, el sistema registrara automaticamente ENTRADA o SALIDA segun el ultimo movimiento del estudiante."
              buttonLabel="Abrir camara para acceso"
              onScan={async (decodedText) => {
                setError("");
                setStatus("QR detectado. Registrando movimiento...");
                await registerMovement(decodedText.trim());
              }}
            />
            {status ? <div className="form-success">{status}</div> : null}
          </article>

          <article className="info-card movement-last-card">
            <p className="eyebrow">Ultima lectura</p>
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
                </div>
              </div>
            ) : (
              <div className="empty-state">
                Aun no hay una lectura reciente en esta sesion. Escanea un QR para ver aqui el ultimo acceso procesado.
              </div>
            )}
          </article>
        </div>
      )}

      {error ? <div className="form-error">{error}</div> : null}

      <div className="cards-grid cards-grid--asymmetric">
        <article className="info-card info-card--narrow">
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
                    <th>Documento</th>
                    <th>Placa</th>
                    <th>Usuario</th>
                    <th>Ultimo movimiento</th>
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
                      <td>{item.documento}</td>
                      <td><span className="plate-chip">{item.placa || "-"}</span></td>
                      <td>{item.usuario || item.actor_username || user?.username || "-"}</td>
                      <td><span className="movement-time">{formatDate(item.fecha_ultimo_movimiento)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="info-card info-card--wide">
          <div className="table-head">
            <div>
              <p className="eyebrow">Actividad reciente</p>
              <h3>Historico de movimientos</h3>
            </div>
            <span className="table-count">{allMovements.length} evento(s)</span>
          </div>
          {allMovements.length === 0 ? (
            <div className="empty-state">Aun no hay movimientos registrados.</div>
          ) : (
            <div className="table-wrap table-wrap--scrollable">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Estudiante</th>
                    <th>Documento</th>
                    <th>Tipo</th>
                    <th>Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {allMovements.map((item) => (
                    <tr key={item.id}>
                      <td><span className="movement-time">{formatDate(item.fecha_hora)}</span></td>
                      <td>
                        <div className="movement-cell-strong">
                          <span className="movement-main">{item.nombre}</span>
                          <span className="movement-sub">Movimiento #{item.id}</span>
                        </div>
                      </td>
                      <td>{item.documento}</td>
                      <td>
                        <span className={`movement-pill ${item.tipo === "ENTRADA" ? "entry" : "exit"}`}>
                          {item.tipo}
                        </span>
                      </td>
                      <td>{item.usuario || item.actor_username || user?.username || "-"}</td>
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
