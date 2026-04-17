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

  it("separa gestión y admisiones en vistas internas", async () => {
    const apiRequest = vi.fn(async (url) => {
      if (url === "/admin/usuarios") {
        return {
          usuarios: [
            { id: 1, username: "admin", role: "ADMIN", is_active: true, created_at: null, updated_at: null },
            { id: 4, username: "guarda", role: "GUARDA", is_active: false, created_at: null, updated_at: null, deactivated_at: null },
          ],
        };
      }

      if (url === "/admin/estudiantes") {
        return {
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
        };
      }

      if (url === "/solicitudes-inscripcion?estado=PENDIENTE") {
        return {
          solicitudes: [
            {
              id: 11,
              documento: "11223344",
              nombre: "Solicitud Demo",
              carrera: "Ingeniería Mecatrónica - 110402",
              correo_institucional: "demo@cide.edu.co",
              placa: "AAA11A",
              color: "Negro",
              placa_secundaria: null,
              color_secundaria: null,
              qr_imagen_url: "uploads/qr.jpg",
              tarjeta_propiedad_principal_url: "uploads/t1.jpg",
              tarjeta_propiedad_secundaria_url: null,
              estado: "PENDIENTE",
              expires_at: null,
              reviewed_at: null,
              reviewed_by_username: null,
            },
          ],
        };
      }

      return { solicitudes: [] };
    });

    authMock.useAuth.mockReturnValue({ apiRequest, user: { id: 1, username: "admin" } });

    render(
      <MemoryRouter>
        <Admin />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith("/admin/usuarios");
      expect(apiRequest).toHaveBeenCalledWith("/admin/estudiantes");
      expect(apiRequest).toHaveBeenCalledWith("/solicitudes-inscripcion?estado=PENDIENTE");
    });

    expect(screen.getByRole("heading", { name: /usuarios del sistema/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /bandeja de aprobación administrativa/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /admisiones/i }));

    expect(await screen.findByRole("heading", { name: /bandeja de aprobación administrativa/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /aprobar/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /usuarios del sistema/i })).not.toBeInTheDocument();
  });

  it("abre el modal para reactivar un estudiante desactivado", async () => {
    const apiRequest = vi.fn(async (url) => {
      if (url === "/admin/usuarios") return { usuarios: [] };
      if (url === "/admin/estudiantes") {
        return {
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
        };
      }
      if (url === "/solicitudes-inscripcion?estado=PENDIENTE") return { solicitudes: [] };
      return { solicitudes: [] };
    });

    authMock.useAuth.mockReturnValue({ apiRequest, user: { id: 1, username: "admin" } });

    render(
      <MemoryRouter>
        <Admin />
      </MemoryRouter>
    );

    expect(await screen.findByRole("button", { name: /reactivar/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /reactivar/i }));

    expect(await screen.findByRole("heading", { name: /reactivar estudiante/i })).toBeInTheDocument();
    expect(screen.getByText(/esta acción habilitará nuevamente al estudiante/i)).toBeInTheDocument();
  });
});
