import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import QrScanner from "../components/QrScanner.jsx";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${date.toLocaleDateString("es-CO")} ${date.toLocaleTimeString("es-CO")}`;
}

export default function Movimientos() {
  const { role, apiRequest } = useAuth();
  const [insideCampus, setInsideCampus] = useState([]);
  const [allMovements, setAllMovements] = useState([]);
  const [form, setForm] = useState({ qr_uid: "" });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const canRegister = role === "ADMIN" || role === "GUARDA";

  async function refreshData() {
    const payloads = await Promise.all([
      apiRequest("/movimientos/dentro-campus"),
      apiRequest("/movimientos"),
    ]);

    setInsideCampus(payloads[0].estudiantes || []);
    setAllMovements(payloads[1].movimientos || []);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setError("");

      try {
        const payloads = await Promise.all([
          apiRequest("/movimientos/dentro-campus"),
          apiRequest("/movimientos"),
        ]);

        if (!cancelled) {
          setInsideCampus(payloads[0].estudiantes || []);
          setAllMovements(payloads[1].movimientos || []);
        }
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
  }, [apiRequest, role, status]);

  async function registerMovement(qrValue) {
    const data = await apiRequest("/movimientos/registrar", {
      method: "POST",
      body: JSON.stringify({ qr_uid: qrValue }),
    });

    setStatus(`${data.movimiento.tipo} registrada para ${data.estudiante.nombre}`);
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
        <article className="info-card">
          <h3>Registrar entrada o salida</h3>
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
      )}

      {error ? <div className="form-error">{error}</div> : null}

      <div className="cards-grid">
        <article className="info-card">
          <h3>Dentro del campus</h3>
          {insideCampus.length === 0 ? (
            <div className="empty-state">No hay estudiantes dentro del campus en este momento.</div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Documento</th>
                    <th>Nombre</th>
                    <th>Placa</th>
                    <th>Ultimo movimiento</th>
                  </tr>
                </thead>
                <tbody>
                  {insideCampus.map((item) => (
                    <tr key={`${item.estudiante_id}-${item.documento}`}>
                      <td>{item.documento}</td>
                      <td>{item.nombre}</td>
                      <td>{item.placa || "-"}</td>
                      <td>{formatDate(item.fecha_ultimo_movimiento)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="info-card">
          <h3>Historico de movimientos</h3>
          {allMovements.length === 0 ? (
            <div className="empty-state">Aun no hay movimientos registrados.</div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Documento</th>
                    <th>Estudiante</th>
                    <th>Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {allMovements.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDate(item.fecha_hora)}</td>
                      <td>{item.documento}</td>
                      <td>{item.nombre}</td>
                      <td>{item.tipo}</td>
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
