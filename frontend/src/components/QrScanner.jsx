import { useEffect, useId, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

export default function QrScanner({
  title = "Escaner QR",
  helpText = "Activa la camara del equipo y apunta al codigo QR.",
  buttonLabel = "Activar camara",
  onScan,
}) {
  const scannerId = useId().replace(/:/g, "");
  const scannerRef = useRef(null);
  const lastScannedRef = useRef("");
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState("Camara lista para iniciar.");
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => null).finally(() => {
          scannerRef.current?.clear().catch(() => null);
          scannerRef.current = null;
        });
      }
    };
  }, []);

  async function stopScanner() {
    if (!scannerRef.current) return;

    try {
      await scannerRef.current.stop();
    } catch (_) {
      // no-op
    }

    try {
      await scannerRef.current.clear();
    } catch (_) {
      // no-op
    }

    scannerRef.current = null;
    setIsRunning(false);
    setStatus("Camara detenida.");
  }

  async function startScanner() {
    setError("");
    setStatus("Solicitando acceso a la camara...");

    if (scannerRef.current) {
      await stopScanner();
    }

    const scanner = new Html5Qrcode(scannerId);
    scannerRef.current = scanner;
    lastScannedRef.current = "";

    try {
      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 240, height: 240 },
          aspectRatio: 1.3333333,
        },
        async (decodedText) => {
          if (!decodedText || decodedText === lastScannedRef.current) {
            return;
          }

          lastScannedRef.current = decodedText;
          setStatus(`QR detectado: ${decodedText}`);

          try {
            await onScan?.(decodedText);
            await stopScanner();
          } catch (scanError) {
            setError(scanError.message || "No se pudo procesar el QR.");
            lastScannedRef.current = "";
          }
        },
        () => null
      );

      setIsRunning(true);
      setStatus("Camara activa. Apunta al QR para continuar.");
    } catch (cameraError) {
      scannerRef.current = null;
      setIsRunning(false);
      setError("No se pudo iniciar la camara. Revisa permisos o disponibilidad del dispositivo.");
      setStatus("Camara no disponible.");
      try {
        await scanner.clear();
      } catch (_) {
        // no-op
      }
    }
  }

  return (
    <div className="qr-scanner">
      <div className="qr-scanner__head">
        <div>
          <h4>{title}</h4>
          <p>{helpText}</p>
        </div>
        <div className="button-strip">
          {!isRunning ? (
            <button type="button" onClick={startScanner}>
              {buttonLabel}
            </button>
          ) : (
            <button type="button" className="ghost-button" onClick={stopScanner}>
              Detener camara
            </button>
          )}
        </div>
      </div>

      <div className="qr-scanner__viewport" id={scannerId} />
      <div className="qr-scanner__status">{status}</div>
      {error ? <div className="form-error">{error}</div> : null}
    </div>
  );
}
