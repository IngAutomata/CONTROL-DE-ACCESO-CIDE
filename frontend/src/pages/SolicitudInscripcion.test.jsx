import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import SolicitudInscripcion from "./SolicitudInscripcion.jsx";

vi.mock("../components/QrScanner.jsx", () => ({
  default: function QrScannerMock() {
    return <div data-testid="qr-scanner-mock">scanner</div>;
  },
}));

describe("SolicitudInscripcion", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("valida que el correo sea institucional", async () => {
    render(<SolicitudInscripcion />);

    const qrImageFile = new File(["qr"], "qr.jpg", { type: "image/jpeg" });
    const tarjetaPrincipalFile = new File(["tarjeta"], "tarjeta-principal.jpg", { type: "image/jpeg" });

    fireEvent.change(screen.getByLabelText(/documento/i), { target: { value: "12345678" } });
    fireEvent.change(screen.getByLabelText(/correo institucional/i), { target: { value: "demo@gmail.com" } });
    fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: "Demo Estudiante" } });
    fireEvent.change(screen.getByLabelText(/^celular$/i), { target: { value: "3001234567" } });
    fireEvent.change(screen.getByLabelText(/carrera/i), { target: { value: "Ingeniería Mecatrónica - 108787" } });
    fireEvent.change(screen.getByPlaceholderText(/https:\/\/soe\.cide\.edu\.co\/verificar-estudiante/i), {
      target: { value: "https://soe.cide.edu.co/verificar-estudiante/NjEyMzE2" },
    });
    fireEvent.change(screen.getByLabelText(/placa principal/i), { target: { value: "ABC12D" } });
    fireEvent.change(screen.getByLabelText(/color principal/i), { target: { value: "Negro" } });
    fireEvent.change(screen.getByLabelText(/imagen del qr institucional/i), {
      target: { files: [qrImageFile] },
    });
    fireEvent.change(screen.getByLabelText(/tarjeta de propiedad moto principal/i), {
      target: { files: [tarjetaPrincipalFile] },
    });
    fireEvent.click(screen.getByRole("checkbox"));

    const form = screen.getByRole("button", { name: /enviar solicitud de inscripción/i }).closest("form");
    fireEvent.submit(form);

    expect(await screen.findByText(/el correo institucional debe terminar en @cide\.edu\.co/i)).toBeInTheDocument();
  });
});
