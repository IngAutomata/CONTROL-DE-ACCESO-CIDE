import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import Dashboard from "./Dashboard.jsx";

const authMock = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

vi.mock("../context/AuthContext.jsx", () => authMock);

describe("Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("carga métricas y muestra el último movimiento para admin", async () => {
    const apiRequest = vi.fn((path) => {
      if (path === "/auth/me") return Promise.resolve({ id: 1, username: "admin" });
      if (path === "/estudiantes") return Promise.resolve({ count: 2, estudiantes: [{ estudiante_id: 1 }, { estudiante_id: 2 }] });
      if (path === "/movimientos/dentro-campus") {
        return Promise.resolve({
          count: 1,
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
        return Promise.resolve({
          count: 3,
          movimientos: [
            {
              id: 99,
              tipo: "ENTRADA",
              nombre: "Luis Prueba",
              documento: "12345678",
              fecha_hora: "2026-04-13T10:00:00.000Z",
              actor_username: "admin",
            },
          ],
        });
      }
      if (path === "/admin/usuarios") return Promise.resolve({ count: 4, usuarios: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }] });
      return Promise.reject(new Error(`Ruta no mockeada: ${path}`));
    });

    authMock.useAuth.mockReturnValue({
      role: "ADMIN",
      user: { username: "admin" },
      apiRequest,
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: /bienvenido, admin/i })).toBeInTheDocument();
    expect(screen.getByText(/control total del sistema/i)).toBeInTheDocument();
    expect(screen.getAllByText(/responsable: admin/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /^usuarios$/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith("/admin/usuarios");
    });
  });

  it("muestra el enfoque de consulta para ese rol", async () => {
    const apiRequest = vi.fn((path) => {
      if (path === "/auth/me") return Promise.resolve({ id: 5, username: "consulta" });
      if (path === "/estudiantes") return Promise.resolve({ count: 0, estudiantes: [] });
      if (path === "/movimientos/dentro-campus") return Promise.resolve({ count: 0, estudiantes: [] });
      if (path === "/movimientos") return Promise.resolve({ count: 0, movimientos: [] });
      return Promise.reject(new Error(`Ruta no mockeada: ${path}`));
    });

    authMock.useAuth.mockReturnValue({
      role: "CONSULTA",
      user: { username: "consulta" },
      apiRequest,
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    expect(await screen.findByText(/lectura supervisada/i)).toBeInTheDocument();
    expect(screen.getByText(/consulta controlada/i)).toBeInTheDocument();
    expect(screen.getByText(/sin actividad reciente/i)).toBeInTheDocument();
  });
});


