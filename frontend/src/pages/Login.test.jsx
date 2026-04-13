import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import Login from "./Login.jsx";

const authMock = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

vi.mock("../context/AuthContext.jsx", () => authMock);

describe("Login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza el acceso institucional", () => {
    authMock.useAuth.mockReturnValue({
      isAuthenticated: false,
      login: vi.fn(),
      loading: false,
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: /iniciar sesi\u00f3n/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/ingresa tu usuario/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/ingresa tu contrase\u00f1a/i)).toBeInTheDocument();
    expect(screen.getByText(/portal listo para autenticaci\u00f3n/i)).toBeInTheDocument();
  });

  it("muestra error si el login falla", async () => {
    const login = vi.fn().mockRejectedValue(new Error("Credenciales inv\u00e1lidas"));

    authMock.useAuth.mockReturnValue({
      isAuthenticated: false,
      login,
      loading: false,
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/usuario/i), { target: { value: "admin" } });
    fireEvent.change(screen.getByLabelText(/contrase\u00f1a/i), { target: { value: "Admin123!" } });
    fireEvent.click(screen.getByRole("button", { name: /iniciar sesi\u00f3n/i }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith("admin", "Admin123!");
    });

    expect(await screen.findByText(/credenciales inv\u00e1lidas/i)).toBeInTheDocument();
    expect(screen.getByText(/no fue posible iniciar sesi\u00f3n/i)).toBeInTheDocument();
  });
});
