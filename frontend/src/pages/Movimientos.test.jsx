import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import Movimientos from "./Movimientos.jsx";

const authMock = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

vi.mock("../context/AuthContext.jsx", () => authMock);
vi.mock("../components/QrScanner.jsx", () => ({
  default: function QrScannerMock() {
    return <div data-testid="qr-scanner-mock">scanner</div>;
  },
}));

describe("Movimientos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("valida el formato del QR antes de registrar", async () => {
    const apiRequest = vi.fn((path) => {
      if (path === "/movimientos/dentro-campus") return Promise.resolve({ estudiantes: [] });
      if (path === "/movimientos") return Promise.resolve({ movimientos: [] });
      return Promise.reject(new Error(`Ruta no mockeada: ${path}`));
    });

    authMock.useAuth.mockReturnValue({
      role: "ADMIN",
      apiRequest,
    });

    render(
      <MemoryRouter>
        <Movimientos />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith("/movimientos/dentro-campus");
      expect(apiRequest).toHaveBeenCalledWith("/movimientos");
    });

    fireEvent.change(screen.getByPlaceholderText(/https:\/\/soe.cide.edu.co\/verificar-estudiante/i), {
      target: { value: "qr-invalido" },
    });
    fireEvent.click(screen.getByRole("button", { name: /registrar/i }));

    expect(
      await screen.findByText(/el qr debe tener formato cide/i)
    ).toBeInTheDocument();
  });

  it("registra por cédula y actualiza la última lectura", async () => {
    const apiRequest = vi.fn((path, options) => {
      if (path === "/movimientos/dentro-campus") {
        if (options?.method === "POST") {
          return Promise.resolve({ estudiantes: [] });
        }
        return Promise.resolve({
          estudiantes: [
            {
              estudiante_id: 10,
              nombre: "Luis Prueba",
              documento: "12345678",
              placa: "ABC12D",
              fecha_ultimo_movimiento: "2026-04-13T10:00:00.000Z",
              actor_username: "admin",
            },
          ],
        });
      }
      if (path === "/movimientos") {
        return Promise.resolve({ movimientos: [] });
      }
      if (path === "/movimientos/registrar") {
        expect(options?.method).toBe("POST");
        expect(options?.body).toContain('"documento":"12345678"');
        return Promise.resolve({
          movimiento: {
            tipo: "ENTRADA",
            fecha_hora: "2026-04-13T10:00:00.000Z",
            actor_username: "admin",
          },
          estudiante: {
            nombre: "Luis Prueba",
            documento: "12345678",
            placa: "ABC12D",
            qr_uid: "https://soe.cide.edu.co/verificar-estudiante/NjEyMzE2",
            updated_by_username: "admin",
          },
        });
      }
      return Promise.reject(new Error(`Ruta no mockeada: ${path}`));
    });

    authMock.useAuth.mockReturnValue({
      role: "ADMIN",
      apiRequest,
    });

    render(
      <MemoryRouter>
        <Movimientos />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith("/movimientos/dentro-campus");
      expect(apiRequest).toHaveBeenCalledWith("/movimientos");
    });

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "documento" } });
    fireEvent.change(screen.getByPlaceholderText(/cédula de 8 a 10 dígitos/i), {
      target: { value: "12345678" },
    });
    fireEvent.click(screen.getByRole("button", { name: /registrar/i }));

    expect(await screen.findByText(/entrada registrada para luis prueba/i)).toBeInTheDocument();
    expect(screen.getByText(/responsable: admin/i)).toBeInTheDocument();
    expect(screen.getAllByText(/luis prueba/i).length).toBeGreaterThan(0);
  });

  it("oculta el bloque de registro para consulta", async () => {
    const apiRequest = vi.fn((path) => {
      if (path === "/movimientos/dentro-campus") return Promise.resolve({ estudiantes: [] });
      if (path === "/movimientos") return Promise.resolve({ movimientos: [] });
      return Promise.reject(new Error(`Ruta no mockeada: ${path}`));
    });

    authMock.useAuth.mockReturnValue({
      role: "CONSULTA",
      apiRequest,
    });

    render(
      <MemoryRouter>
        <Movimientos />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: /histórico de movimientos/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /registrar entrada o salida/i })).not.toBeInTheDocument();
  });
});
