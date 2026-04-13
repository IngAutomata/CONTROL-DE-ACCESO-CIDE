import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import Navbar from "./Navbar.jsx";

const authMock = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

vi.mock("../context/AuthContext.jsx", () => authMock);

describe("Navbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra la navegación administrativa completa", () => {
    const logout = vi.fn();

    authMock.useAuth.mockReturnValue({
      user: { username: "admin" },
      role: "ADMIN",
      logout,
    });

    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    );

    expect(screen.getByText(/bienvenido/i)).toBeInTheDocument();
    expect(screen.getByText("admin")).toBeInTheDocument();
    expect(screen.getByText(/rol activo: admin/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /administración/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /cerrar sesión/i }));
    expect(logout).toHaveBeenCalled();
  });

  it("oculta administración para guarda", () => {
    authMock.useAuth.mockReturnValue({
      user: { username: "guarda" },
      role: "GUARDA",
      logout: vi.fn(),
    });

    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    );

    expect(screen.queryByRole("link", { name: /administración/i })).not.toBeInTheDocument();
    expect(screen.getByText(/operación de acceso y monitoreo/i)).toBeInTheDocument();
  });
});
