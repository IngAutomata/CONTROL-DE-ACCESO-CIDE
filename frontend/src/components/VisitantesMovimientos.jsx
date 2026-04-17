import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

const DOCUMENTO_REGEX = /^[A-Z0-9-]{5,20}$/;
const CELULAR_REGEX = /^\d{10}$/;
const PLACA_REGEX = /^[A-Z]{3}\d{2}[A-Z0-9]$/;

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${date.toLocaleDateString("es-CO")} ${date.toLocaleTimeString("es-CO")}`;
}

export default function VisitantesMovimientos() {
  const { role, apiRequest } = useAuth();
  const canRegister = role === "ADMIN" || role === "GUARDA";
  const [insideCampus, setInsideCampus] = useState([]);
  const [allMovements, setAllMovements] = useState([]);
  const [registeredVisitors, setRegisteredVisitors] = useState([]);
  const [registerMode, setRegisterMode] = useState("documento");
  const [form, setForm] = useState({
    documento: "",
    nombre: "",
    celular: "",
    placa: "",
    entidad: "",
    motivo_visita: "",
    persona_visitada: "",
    observaciones: "",
  });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [lastRegistered, setLastRegistered] = useState(null);

  const refreshData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setError("");
    }

    const payloads = await Promise.all([
      apiRequest("/visitantes/dentro-campus"),
      apiRequest("/visitantes/movimientos"),
      apiRequest("/visitantes"),
    ]);

    setInsideCampus(payloads[0].visitantes || []);
    setAllMovements(payloads[1].movimientos || []);
    setRegisteredVisitors(payloads[2].visitantes || []);
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
  }, [refreshData]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      refreshData({ silent: true }).catch(() => null);
    }, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, [refreshData]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setStatus("");

    if (!canRegister) {
      setError("Tu rol solo permite consultar visitantes.");
      return;
    }

    try {
      if (registerMode === "documento" && !DOCUMENTO_REGEX.test(form.documento.trim().toUpperCase())) {
        throw new Error("El documento del visitante debe tener entre 5 y 20 caracteres alfanuméricos.");
      }

      if (registerMode === "placa" && !PLACA_REGEX.test(form.placa.trim().toUpperCase())) {
        throw new Error("La placa debe tener formato válido colombiano.");
      }

      if (registerMode === "documento" && form.celular && !CELULAR_REGEX.test(form.celular.trim())) {
        throw new Error("El celular del visitante debe tener exactamente 10 números.");
      }

      const payload = registerMode === "documento"
        ? {
            documento: form.documento.trim().toUpperCase(),
            nombre: form.nombre.trim(),
            celular: form.celular.trim(),
            placa: form.placa.trim().toUpperCase(),
            entidad: form.entidad.trim(),
            motivo_visita: form.motivo_visita.trim(),
            persona_visitada: form.persona_visitada.trim(),
            observaciones: form.observaciones.trim(),
          }
        : {
            placa: form.placa.trim().toUpperCase(),
          };

      const data = await apiRequest("/visitantes/registrar", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setStatus(`${data.movimiento.tipo} registrada para ${data.visitante.nombre}`);
      setLastRegistered({
        tipo: data.movimiento.tipo,
        nombre: data.visitante.nombre,
        documento: data.visitante.documento,
        placa: data.movimiento.vehiculo_placa || data.visitante.placa || "-",
        personaVisitada: data.movimiento.persona_visitada || "-",
        motivoVisita: data.movimiento.motivo_visita || "-",
        fecha: data.movimiento.fecha_hora,
        actor: role,
      });
      setForm({
        documento: "",
        nombre: "",
        celular: "",
        placa: "",
        entidad: "",
        motivo_visita: "",
        persona_visitada: "",
        observaciones: "",
      });
      await refreshData();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      {canRegister ? (
        <div className="cards-grid cards-grid--wide-main movement-grid">
          <article className="info-card movement-register-card">
            <div className="movement-register-head">
              <div>
                <p className="eyebrow">Visitantes en tiempo real</p>
                <h3>Registrar entrada o salida de visitante</h3>
                <p className="movement-copy">
                  Usa documento para registrar entrada o salida del visitante. La placa queda disponible como salida rápida cuando el visitante ya está dentro del campus.
                </p>
              </div>
              <div className="movement-mode-badge">Modo {role}</div>
            </div>

            <form className="inline-form" onSubmit={handleSubmit}>
              <select value={registerMode} onChange={(event) => setRegisterMode(event.target.value)}>
                <option value="documento">Registrar por documento</option>
                <option value="placa">Salida rápida por placa</option>
              </select>
              {registerMode === "documento" ? (
                <div className="stack-form">
                  <input
                    type="text"
                    placeholder="Documento del visitante"
                    value={form.documento}
                    onChange={(event) => setForm((current) => ({ ...current, documento: event.target.value.toUpperCase() }))}
                    required
                  />
                  <div className="form-grid-2">
                    <label>
                      Nombre completo
                      <input
                        type="text"
                        value={form.nombre}
                        onChange={(event) => setForm((current) => ({ ...current, nombre: event.target.value }))}
                        placeholder="Nombre del visitante"
                      />
                    </label>
                    <label>
                      Celular
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={10}
                        value={form.celular}
                        onChange={(event) => setForm((current) => ({ ...current, celular: event.target.value.replace(/\D/g, "").slice(0, 10) }))}
                        placeholder="Número de contacto"
                      />
                    </label>
                    <label>
                      Placa
                      <input
                        type="text"
                        maxLength={6}
                        value={form.placa}
                        onChange={(event) => setForm((current) => ({ ...current, placa: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) }))}
                        placeholder="Placa si aplica"
                      />
                    </label>
                    <label>
                      Entidad o procedencia
                      <input
                        type="text"
                        value={form.entidad}
                        onChange={(event) => setForm((current) => ({ ...current, entidad: event.target.value }))}
                        placeholder="Empresa, contratista o visitante externo"
                      />
                    </label>
                    <label>
                      Motivo de visita
                      <input
                        type="text"
                        value={form.motivo_visita}
                        onChange={(event) => setForm((current) => ({ ...current, motivo_visita: event.target.value }))}
                        placeholder="Reunión, mantenimiento, proveedor, etc."
                      />
                    </label>
                    <label>
                      Persona a quien visita
                      <input
                        type="text"
                        value={form.persona_visitada}
                        onChange={(event) => setForm((current) => ({ ...current, persona_visitada: event.target.value }))}
                        placeholder="Nombre del contacto en campus"
                      />
                    </label>
                  </div>
                  <label>
                    Observaciones
                    <input
                      type="text"
                      value={form.observaciones}
                      onChange={(event) => setForm((current) => ({ ...current, observaciones: event.target.value }))}
                      placeholder="Detalle adicional si aplica"
                    />
                  </label>
                  <div className="empty-state">
                    Si el visitante ya está registrado y sigue dentro, el sistema tomará este documento para registrar la salida sin volver a pedir todos los datos.
                  </div>
                </div>
              ) : (
                <div className="stack-form">
                  <input
                    type="text"
                    placeholder="Placa actual dentro del campus"
                    maxLength={6}
                    value={form.placa}
                    onChange={(event) => setForm((current) => ({ ...current, placa: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) }))}
                    required
                  />
                  <div className="empty-state">
                    Usa este modo solo para salida rápida cuando el visitante ya está dentro con esa placa.
                  </div>
                </div>
              )}
              <button type="submit">Registrar</button>
            </form>
            {status ? <div className="form-success">{status}</div> : null}
          </article>

          <article className="info-card movement-last-card">
            <p className="eyebrow">Último visitante</p>
            <h3>Resultado del registro</h3>
            {lastRegistered ? (
              <div className="scan-result">
                <span className={`movement-pill ${lastRegistered.tipo === "ENTRADA" ? "entry" : "exit"}`}>
                  {lastRegistered.tipo}
                </span>
                <strong className="scan-result__name">{lastRegistered.nombre}</strong>
                <div className="scan-result__meta">
                  <span>Documento: {lastRegistered.documento}</span>
                  <span>Placa: {lastRegistered.placa}</span>
                  <span>Persona visitada: {lastRegistered.personaVisitada}</span>
                  <span>Motivo: {lastRegistered.motivoVisita}</span>
                  <span>Hora: {formatDate(lastRegistered.fecha)}</span>
                  <span>Responsable: {lastRegistered.actor}</span>
                </div>
              </div>
            ) : (
              <div className="empty-state">Aún no hay un registro reciente de visitantes en esta sesión.</div>
            )}
          </article>
        </div>
      ) : null}

      {error ? <div className="form-error">{error}</div> : null}

      <div className="cards-grid cards-grid--single">
        <article className="info-card">
          <div className="table-head">
            <div>
              <p className="eyebrow">Presencia activa</p>
              <h3>Visitantes dentro del campus</h3>
            </div>
            <span className="table-count">{insideCampus.length} visible(s)</span>
          </div>
          {insideCampus.length === 0 ? (
            <div className="empty-state">No hay visitantes dentro del campus en este momento.</div>
          ) : (
            <div className="table-wrap table-wrap--scrollable">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Visitante</th>
                    <th>Placa</th>
                    <th>Persona visitada</th>
                    <th>Motivo</th>
                    <th>Responsable</th>
                    <th>Último movimiento</th>
                  </tr>
                </thead>
                <tbody>
                  {insideCampus.map((item) => (
                    <tr key={`${item.visitante_id}-${item.documento}`}>
                      <td>
                        <div className="movement-cell-strong">
                          <span className="movement-main">{item.nombre}</span>
                          <span className="movement-sub">DOC {item.documento}</span>
                        </div>
                      </td>
                      <td><span className="plate-chip">{item.placa || "-"}</span></td>
                      <td>{item.persona_visitada || "-"}</td>
                      <td>{item.motivo_visita || "-"}</td>
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
              <p className="eyebrow">Perfiles registrados</p>
              <h3>Visitantes del sistema</h3>
            </div>
            <span className="table-count">{registeredVisitors.length} perfil(es)</span>
          </div>
          {registeredVisitors.length === 0 ? (
            <div className="empty-state">A?n no hay visitantes registrados en el sistema.</div>
          ) : (
            <div className="table-wrap table-wrap--scrollable">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Documento</th>
                    <th>Nombre</th>
                    <th>Celular</th>
                    <th>Placa</th>
                    <th>Entidad</th>
                    <th>Actualizado</th>
                  </tr>
                </thead>
                <tbody>
                  {registeredVisitors.map((item) => (
                    <tr key={item.id}>
                      <td>{item.documento}</td>
                      <td>{item.nombre}</td>
                      <td>{item.celular}</td>
                      <td><span className="plate-chip">{item.placa || "-"}</span></td>
                      <td>{item.entidad || "-"}</td>
                      <td><span className="movement-time">{formatDate(item.updated_at)}</span></td>
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
              <h3>Histórico de visitantes</h3>
            </div>
            <span className="table-count">{allMovements.length} evento(s)</span>
          </div>
          {allMovements.length === 0 ? (
            <div className="empty-state">Aún no hay movimientos de visitantes registrados.</div>
          ) : (
            <div className="table-wrap table-wrap--scrollable">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Visitante</th>
                    <th>Tipo</th>
                    <th>Placa</th>
                    <th>Persona visitada</th>
                    <th>Motivo</th>
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
                          <span className="movement-sub">DOC {item.documento} · Movimiento #{item.id}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`movement-pill ${item.tipo === "ENTRADA" ? "entry" : "exit"}`}>
                          {item.tipo}
                        </span>
                      </td>
                      <td><span className="plate-chip">{item.placa || "-"}</span></td>
                      <td>{item.persona_visitada || "-"}</td>
                      <td>{item.motivo_visita || "-"}</td>
                      <td>{item.actor_username || "Sin responsable"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </div>
    </>
  );
}