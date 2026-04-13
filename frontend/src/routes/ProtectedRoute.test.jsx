import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import ProtectedRoute from "./ProtectedRoute.jsx";

const authMock = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

vi.mock("../context/AuthContext", () => authMock);

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirige al login si no hay sesión", () => {
    authMock.useAuth.mockReturnValue({
      isAuthenticated: false,
      role: null,
    });

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/login" element={<div>Login mock</div>} />
          <Route element={<ProtectedRoute allowedRoles={["ADMIN"]} />}>
            <Route path="/admin" element={<div>Admin privado</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Login mock")).toBeInTheDocument();
    expect(screen.queryByText("Admin privado")).not.toBeInTheDocument();
  });

  it("redirige al inicio si el rol no está autorizado", () => {
    authMock.useAuth.mockReturnValue({
      isAuthenticated: true,
      role: "GUARDA",
    });

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/" element={<div>Inicio público</div>} />
          <Route element={<ProtectedRoute allowedRoles={["ADMIN"]} />}>
            <Route path="/admin" element={<div>Admin privado</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Inicio público")).toBeInTheDocument();
    expect(screen.queryByText("Admin privado")).not.toBeInTheDocument();
  });

  it("muestra el contenido si el rol sí está autorizado", () => {
    authMock.useAuth.mockReturnValue({
      isAuthenticated: true,
      role: "ADMIN",
    });

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route element={<ProtectedRoute allowedRoles={["ADMIN"]} />}>
            <Route path="/admin" element={<div>Admin privado</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Admin privado")).toBeInTheDocument();
  });
});
