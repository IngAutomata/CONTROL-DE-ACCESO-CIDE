import { useMemo, useState } from "react";
import QrScanner from "../components/QrScanner.jsx";
import { CAREERS } from "../constants/careers.js";

const CIDE_QR_REGEX = /^https:\/\/soe\.cide\.edu\.co\/verificar-estudiante\/[A-Za-z0-9]{1,8}$/;
const DOCUMENTO_REGEX = /^\d{8,10}$/;
const CELULAR_REGEX = /^\d{10}$/;
const PLACA_REGEX = /^[A-Z]{3}\d{2}[A-Z]$/;
const CORREO_CIDE_REGEX = /^[A-Za-z0-9._%+-]+@cide\.edu\.co$/i;

const initialForm = {
  documento: "",
  qr_uid: "",
  nombre: "",
  carrera: "",
  correo_institucional: "",
  celular: "",
  placa: "",
  color: "",
  placa_secundaria: "",
  color_secundaria: "",
  qr_imagen_url: "",
  tarjeta_propiedad_principal_url: "",
  tarjeta_propiedad_secundaria_url: "",
  autoriza_tratamiento_datos: false,
};

const initialAttachments = {
  qr_imagen_file: null,
  tarjeta_propiedad_principal_file: null,
  tarjeta_propiedad_secundaria_file: null,
};

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : value;
}

function normalizePlate(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : value;
}

async function publicRequest(url, options = {}) {
  const response = await fetch(url.startsWith("/") ? `/api${url}` : url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch (_) {
      data = { error: text };
    }
  }

  if (!response.ok) {
    throw new Error(data.error || "No fue posible registrar la solicitud.");
  }

  return data;
}

export default function SolicitudInscripcion() {
  const [form, setForm] = useState(initialForm);
  const [attachments, setAttachments] = useState(initialAttachments);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const secondaryMotoEnabled = useMemo(
    () => Boolean(form.placa_secundaria || form.color_secundaria || attachments.tarjeta_propiedad_secundaria_file),
    [attachments.tarjeta_propiedad_secundaria_file, form.color_secundaria, form.placa_secundaria]
  );

  function validateForm() {
    if (!DOCUMENTO_REGEX.test(form.documento)) return "La cédula debe tener entre 8 y 10 dígitos numéricos.";
    if (!CIDE_QR_REGEX.test(form.qr_uid)) return "El QR debe tener el formato institucional de CIDE.";
    if (!normalizeText(form.nombre)) return "Debes ingresar el nombre completo.";
    if (!normalizeText(form.carrera)) return "Debes seleccionar la carrera.";
    if (!CORREO_CIDE_REGEX.test(form.correo_institucional)) return "El correo institucional debe terminar en @cide.edu.co.";
    if (!CELULAR_REGEX.test(form.celular)) return "El celular debe tener exactamente 10 números.";
    if (!PLACA_REGEX.test(form.placa)) return "La placa principal debe tener formato ABC12D.";
    if (!normalizeText(form.color)) return "Debes registrar el color de la moto principal.";
    if (!attachments.qr_imagen_file) return "Debes adjuntar la imagen del QR institucional.";
    if (!attachments.tarjeta_propiedad_principal_file) return "Debes adjuntar la tarjeta de propiedad de la moto principal.";
    if (secondaryMotoEnabled) {
      if (!PLACA_REGEX.test(form.placa_secundaria)) return "La placa secundaria debe tener formato ABC12D.";
      if (!normalizeText(form.color_secundaria)) return "Debes registrar el color de la moto secundaria.";
      if (!attachments.tarjeta_propiedad_secundaria_file) return "Debes adjuntar la tarjeta de propiedad de la moto secundaria.";
      if (normalizePlate(form.placa_secundaria) === normalizePlate(form.placa)) {
        return "La moto secundaria no puede repetir la placa principal.";
      }
    }
    if (!form.autoriza_tratamiento_datos) return "Debes aceptar la autorización de tratamiento de datos antes de enviar.";
    return "";
  }

  async function toBase64Payload(file) {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";

    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });

    return {
      fileName: file.name,
      mimeType: file.type,
      base64Data: btoa(binary),
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setStatus("");

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const payload = {
        ...form,
        documento: normalizeText(form.documento),
        qr_uid: normalizeText(form.qr_uid),
        nombre: normalizeText(form.nombre),
        carrera: normalizeText(form.carrera),
        correo_institucional: normalizeText(form.correo_institucional).toLowerCase(),
        celular: normalizeText(form.celular),
        placa: normalizePlate(form.placa),
        color: normalizeText(form.color),
        placa_secundaria: secondaryMotoEnabled ? normalizePlate(form.placa_secundaria) : "",
        color_secundaria: secondaryMotoEnabled ? normalizeText(form.color_secundaria) : "",
        qr_imagen_url: "",
        tarjeta_propiedad_principal_url: "",
        tarjeta_propiedad_secundaria_url: "",
        qr_imagen_file: await toBase64Payload(attachments.qr_imagen_file),
        tarjeta_propiedad_principal_file: await toBase64Payload(attachments.tarjeta_propiedad_principal_file),
        tarjeta_propiedad_secundaria_file: secondaryMotoEnabled && attachments.tarjeta_propiedad_secundaria_file
          ? await toBase64Payload(attachments.tarjeta_propiedad_secundaria_file)
          : null,
      };

      await publicRequest("/solicitudes-inscripcion", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setStatus("Solicitud enviada correctamente. El área administrativa la revisará y responderá al correo institucional registrado.");
      setForm(initialForm);
      setAttachments(initialAttachments);
    } catch (err) {
      setError(err.message || "No fue posible enviar la solicitud.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell auth-shell--form">
      <div className="auth-backdrop" />
      <section className="auth-panel">
        <header className="auth-brand">
          <p className="eyebrow">Formulario institucional</p>
          <h1 className="auth-wordmark">SIUC</h1>
          <p className="auth-submark">Inscripción y validación de ingreso estudiantil</p>
        </header>

        <article className="auth-card auth-card--wide">
          <div className="auth-card-head">
            <p className="eyebrow">Solicitud de inscripción</p>
            <h2>Registrar datos para aprobación</h2>
            <p className="auth-copy">
              Completa este formulario con tu información institucional, QR y datos de motocicletas. La administración revisará tu solicitud antes de activarte en el sistema.
            </p>
          </div>

          <form className="stack-form" onSubmit={handleSubmit}>
            <div className="form-grid-2">
              <label>
                Documento
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  value={form.documento}
                  onChange={(event) => setForm((current) => ({ ...current, documento: event.target.value.replace(/\D/g, "").slice(0, 10) }))}
                  placeholder="Cédula de 8 a 10 dígitos"
                  required
                />
              </label>
              <label>
                Correo institucional
                <input
                  type="email"
                  value={form.correo_institucional}
                  onChange={(event) => setForm((current) => ({ ...current, correo_institucional: event.target.value }))}
                  placeholder="usuario@cide.edu.co"
                  required
                />
              </label>
              <label>
                Nombre completo
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(event) => setForm((current) => ({ ...current, nombre: event.target.value }))}
                  placeholder="Escribe tus nombres y apellidos"
                  required
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
                  placeholder="10 números"
                  required
                />
              </label>
              <label>
                Carrera
                <select
                  value={form.carrera}
                  onChange={(event) => setForm((current) => ({ ...current, carrera: event.target.value }))}
                  required
                >
                  <option value="">Selecciona una carrera</option>
                  {CAREERS.map((carrera) => (
                    <option key={carrera} value={carrera}>
                      {carrera}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                QR institucional
                <input
                  type="text"
                  value={form.qr_uid}
                  onChange={(event) => setForm((current) => ({ ...current, qr_uid: event.target.value.trim() }))}
                  placeholder="https://soe.cide.edu.co/verificar-estudiante/NjEyMzE2"
                  required
                />
              </label>
            </div>

            <QrScanner
              title="Escanear QR institucional"
              helpText="Si tienes el QR en otra pantalla o impreso, puedes usar la cámara del equipo para cargarlo automáticamente en el formulario."
              buttonLabel="Escanear QR con cámara"
              onScan={async (decodedText) => {
                const qrValue = decodedText.trim();
                if (!CIDE_QR_REGEX.test(qrValue)) {
                  throw new Error("El QR escaneado no tiene el formato institucional de CIDE.");
                }

                setForm((current) => ({ ...current, qr_uid: qrValue }));
                setError("");
                setStatus("QR institucional cargado correctamente en el formulario.");
              }}
            />

            <section className="request-block">
              <div className="request-block__head">
                <p className="eyebrow">Moto principal</p>
                <strong>Vehículo principal registrado</strong>
              </div>
              <div className="form-grid-2">
                <label>
                  Placa principal
                  <input
                    type="text"
                    maxLength={6}
                    value={form.placa}
                    onChange={(event) => setForm((current) => ({ ...current, placa: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) }))}
                    placeholder="ABC12D"
                    required
                  />
                </label>
                <label>
                  Color principal
                  <input
                    type="text"
                    value={form.color}
                    onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))}
                    placeholder="Ej. negro"
                    required
                  />
                </label>
                <label>
                  Imagen del QR institucional
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={(event) => setAttachments((current) => ({ ...current, qr_imagen_file: event.target.files?.[0] || null }))}
                    required
                  />
                  <span className="movement-sub">{attachments.qr_imagen_file?.name || "Adjunta JPG, PNG o PDF (máx. 5 MB)"}</span>
                </label>
                <label>
                  Tarjeta de propiedad moto principal
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={(event) => setAttachments((current) => ({ ...current, tarjeta_propiedad_principal_file: event.target.files?.[0] || null }))}
                    required
                  />
                  <span className="movement-sub">{attachments.tarjeta_propiedad_principal_file?.name || "Adjunta JPG, PNG o PDF (máx. 5 MB)"}</span>
                </label>
              </div>
            </section>

            <section className="request-block">
              <div className="request-block__head">
                <p className="eyebrow">Moto secundaria</p>
                <strong>Vehículo alterno opcional</strong>
              </div>
              <div className="form-grid-2">
                <label>
                  Placa secundaria
                  <input
                    type="text"
                    maxLength={6}
                    value={form.placa_secundaria}
                    onChange={(event) => setForm((current) => ({ ...current, placa_secundaria: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) }))}
                    placeholder="DEF34G"
                  />
                </label>
                <label>
                  Color secundaria
                  <input
                    type="text"
                    value={form.color_secundaria}
                    onChange={(event) => setForm((current) => ({ ...current, color_secundaria: event.target.value }))}
                    placeholder="Ej. blanco"
                  />
                </label>
                <label className="request-block__full">
                  Tarjeta de propiedad moto secundaria
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={(event) => setAttachments((current) => ({ ...current, tarjeta_propiedad_secundaria_file: event.target.files?.[0] || null }))}
                  />
                  <span className="movement-sub">{attachments.tarjeta_propiedad_secundaria_file?.name || "Adjunta JPG, PNG o PDF si registras moto secundaria"}</span>
                </label>
              </div>
            </section>

            <div className="form-note">
              La administración revisará tus documentos, validará tu QR institucional y aprobará o rechazará la solicitud. Si no se responde en 48 horas, la solicitud pasará a estado expirado.
            </div>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.autoriza_tratamiento_datos}
                onChange={(event) => setForm((current) => ({ ...current, autoriza_tratamiento_datos: event.target.checked }))}
              />
              <span>Autorizo el tratamiento de mis datos personales para el control institucional de acceso.</span>
            </label>

            {error ? <div className="form-error">{error}</div> : null}
            {status ? <div className="form-success">{status}</div> : null}

            <button type="submit" disabled={loading}>
              {loading ? "Enviando solicitud..." : "Enviar solicitud de inscripción"}
            </button>
          </form>
        </article>
      </section>
    </main>
  );
}

