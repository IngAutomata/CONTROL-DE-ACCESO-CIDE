import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import Admin from "./Admin.jsx";

const authMock = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

vi.mock("../context/AuthContext.jsx", () => authMock);

describe("Admin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza usuarios y estudiantes con acciones seg\u00fan estado", async () => {
    const apiRequest = vi
      .fn()
      .mockResolvedValueOnce({
        usuarios: [
          { id: 1, username: "admin", role: "ADMIN", is_active: true, created_at: null, updated_at: null },
          { id: 4, username: "guarda", role: "GUARDA", is_active: false, created_at: null, updated_at: null, deactivated_at: null },
        ],
      })
      .mockResolvedValueOnce({
        estudiantes: [
          {
            estudiante_id: 20,
            documento: "12345678",
            nombre: "Activo Demo",
            qr_uid: "https://soe.cide.edu.co/verificar-estudiante/NjEyMzE2",
            placa: "ABC12D",
            celular: "3001234567",
            vigencia: true,
            is_deleted: false,
            created_by_username: "admin",
            updated_by_username: "admin",
            created_at: null,
            updated_at: null,
          },
          {
            estudiante_id: 21,
            documento: "87654321",
            nombre: "Inactivo Demo",
            qr_uid: "https://soe.cide.edu.co/verificar-estudiante/NjA5MTgy",
            placa: "XYZ78K",
            celular: "3007654321",
            vigencia: false,
            is_deleted: true,
            created_by_username: "admin",
            updated_by_username: "admin",
            created_at: null,
            updated_at: null,
            deleted_at: null,
          },
        ],
      });

    authMock.useAuth.mockReturnValue({ apiRequest });

    render(
      <MemoryRouter>
        <Admin />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith("/admin/usuarios");
      expect(apiRequest).toHaveBeenCalledWith("/admin/estudiantes");
    });

    expect(screen.getByRole("heading", { name: /usuarios del sistema/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /desactivar/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /reactivar/i }).length).toBeGreaterThan(0);
  });

  it("abre el modal para reactivar un estudiante desactivado", async () => {
    const apiRequest = vi
      .fn()
      .mockResolvedValueOnce({ usuarios: [] })
      .mockResolvedValueOnce({
        estudiantes: [
          {
            estudiante_id: 21,
            documento: "87654321",
            nombre: "Inactivo Demo",
            qr_uid: "https://soe.cide.edu.co/verificar-estudiante/NjA5MTgy",
            placa: "XYZ78K",
            celular: "3007654321",
            vigencia: false,
            is_deleted: true,
            created_by_username: "admin",
            updated_by_username: "admin",
            created_at: null,
            updated_at: null,
            deleted_at: null,
          },
        ],
      });

    authMock.useAuth.mockReturnValue({ apiRequest });

    render(
      <MemoryRouter>
        <Admin />
      </MemoryRouter>
    );

    expect(await screen.findByRole("button", { name: /reactivar/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /reactivar/i }));

    expect(await screen.findByRole("heading", { name: /reactivar estudiante/i })).toBeInTheDocument();
    expect(screen.getByText(/esta acci\u00f3n habilitar\u00e1 nuevamente al estudiante/i)).toBeInTheDocument();
  });
});
