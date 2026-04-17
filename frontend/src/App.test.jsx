import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import App from "./App.jsx";

const authMock = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

vi.mock("./context/AuthContext.jsx", () => authMock);
vi.mock("./components/Navbar.jsx", () => ({
  default: function NavbarMock() {
    return <div>Navbar mock</div>;
  },
}));
vi.mock("./pages/Dashboard.jsx", () => ({
  default: function DashboardMock() {
    return <div>Dashboard mock</div>;
  },
}));
vi.mock("./pages/Login.jsx", () => ({
  default: function LoginMock() {
    return <div>Login mock</div>;
  },
}));
vi.mock("./pages/Movimientos.jsx", () => ({
  default: function MovimientosMock() {
    return <div>Movimientos mock</div>;
  },
}));
vi.mock("./pages/Admin.jsx", () => ({
  default: function AdminMock() {
    return <div>Admin mock</div>;
  },
}));
vi.mock("./pages/Estudiantes.jsx", () => ({
  default: function EstudiantesMock() {
    return <div>Estudiantes mock</div>;
  },
}));
vi.mock("./pages/SolicitudInscripcion.jsx", () => ({
  default: function SolicitudInscripcionMock() {
    return <div>Solicitud inscripción mock</div>;
  },
}));

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra el estado de verificación cuando aún no está lista la sesión", () => {
    authMock.useAuth.mockReturnValue({
      isAuthenticated: false,
      ready: false,
      role: null,
      user: null,
    });

    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: /verificando sesión/i })).toBeInTheDocument();
  });

  it("redirige al login si no hay autenticación", () => {
    authMock.useAuth.mockReturnValue({
      isAuthenticated: false,
      ready: true,
      role: null,
      user: null,
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText("Login mock")).toBeInTheDocument();
  });

  it("permite abrir el formulario público de inscripción sin autenticación", () => {
    authMock.useAuth.mockReturnValue({
      isAuthenticated: false,
      ready: true,
      role: null,
      user: null,
    });

    render(
      <MemoryRouter initialEntries={["/inscripcion"]}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText("Solicitud inscripción mock")).toBeInTheDocument();
  });

  it("muestra el layout autenticado con banner y navegación", () => {
    authMock.useAuth.mockReturnValue({
      isAuthenticated: true,
      ready: true,
      role: "ADMIN",
      user: { username: "admin" },
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText("Navbar mock")).toBeInTheDocument();
    expect(screen.getByText(/portal operativo siuc/i)).toBeInTheDocument();
    expect(screen.getByText(/admin · admin/i)).toBeInTheDocument();
    expect(screen.getByText("Dashboard mock")).toBeInTheDocument();
  });
});
