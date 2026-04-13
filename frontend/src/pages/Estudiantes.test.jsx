import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import Estudiantes from "./Estudiantes.jsx";

const authMock = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

vi.mock("../context/AuthContext.jsx", () => authMock);
vi.mock("../components/QrScanner.jsx", () => ({
  default: function QrScannerMock() {
    return <div data-testid="qr-scanner-mock">scanner</div>;
  },
}));

describe("Estudiantes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("valida celular exactamente de 10 n\u00fameros", async () => {
    const apiRequest = vi.fn().mockResolvedValue({ estudiantes: [] });

    authMock.useAuth.mockReturnValue({
      apiRequest,
      role: "ADMIN",
    });

    render(
      <MemoryRouter>
        <Estudiantes />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith("/estudiantes");
    });

    fireEvent.change(screen.getByLabelText(/documento/i), { target: { value: "12345678" } });
    fireEvent.change(screen.getByLabelText(/qr uid/i), {
      target: { value: "https://soe.cide.edu.co/verificar-estudiante/NjEyMzE2" },
    });
    fireEvent.change(screen.getByLabelText(/^nombre$/i), { target: { value: "Estudiante Demo" } });
    fireEvent.change(screen.getByLabelText(/celular/i), { target: { value: "3001234" } });
    fireEvent.change(screen.getByLabelText(/placa/i), { target: { value: "ABC12D" } });
    fireEvent.change(screen.getByLabelText(/color/i), { target: { value: "Negro" } });

    fireEvent.click(screen.getByRole("button", { name: /crear estudiante/i }));

    expect(
      await screen.findByText(/el celular debe contener exactamente 10 n\u00fameros/i)
    ).toBeInTheDocument();
  });

  it("muestra modo edici\u00f3n cuando carga un estudiante existente", async () => {
    const student = {
      estudiante_id: 10,
      documento: "12345678",
      qr_uid: "https://soe.cide.edu.co/verificar-estudiante/NjEyMzE2",
      nombre: "Luis Prueba",
      carrera: "Ingenieria de Sistemas - 110399",
      celular: "3001234567",
      vigencia: true,
      placa: "ABC12D",
      color: "Negro",
    };

    const apiRequest = vi
      .fn()
      .mockResolvedValueOnce({ estudiantes: [] })
      .mockResolvedValueOnce(student);

    authMock.useAuth.mockReturnValue({
      apiRequest,
      role: "ADMIN",
    });

    render(
      <MemoryRouter>
        <Estudiantes />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith("/estudiantes");
    });

    fireEvent.change(screen.getByPlaceholderText(/ingresa el documento/i), {
      target: { value: "12345678" },
    });
    fireEvent.click(screen.getByRole("button", { name: /buscar/i }));

    expect(await screen.findByText(/modo edici\u00f3n/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Luis Prueba")).toBeInTheDocument();
  });
});
