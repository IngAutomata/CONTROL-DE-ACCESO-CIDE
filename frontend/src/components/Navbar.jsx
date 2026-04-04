import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const menuByRole = {
  ADMIN: [
    { to: "/", label: "Inicio", icon: "IN" },
    { to: "/estudiantes", label: "Estudiantes", icon: "ES" },
    { to: "/movimientos", label: "Movimientos", icon: "MV" },
    { to: "/admin", label: "Administracion", icon: "AD" },
  ],
  GUARDA: [
    { to: "/", label: "Inicio", icon: "IN" },
    { to: "/estudiantes", label: "Estudiantes", icon: "ES" },
    { to: "/movimientos", label: "Movimientos", icon: "MV" },
  ],
  CONSULTA: [
    { to: "/", label: "Inicio", icon: "IN" },
    { to: "/estudiantes", label: "Estudiantes", icon: "ES" },
    { to: "/movimientos", label: "Movimientos", icon: "MV" },
  ],
};

export default function Navbar() {
  const { user, logout, role } = useAuth();
  const items = menuByRole[role] || [];
  const roleCopy = role === "ADMIN"
    ? "Acceso administrativo completo"
    : role === "GUARDA"
      ? "Operacion de acceso y monitoreo"
      : "Consulta y seguimiento";

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <h1 className="sidebar__wordmark">SIUC</h1>
        <p className="sidebar__submark">Sistema de Ingreso Universidad CIDE</p>
        <p className="sidebar__portal">Portal operativo</p>
      </div>

      <div className="sidebar__toggle">≡</div>

      <nav className="sidebar__nav">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) => `sidebar__link${isActive ? " active" : ""}`}
          >
            <span className="sidebar__icon" aria-hidden="true">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar__footer">
        <div className="sidebar__session">
          <span className="sidebar__welcome">Bienvenido</span>
          <span className="sidebar__user">{user?.username || "Sin sesion"}</span>
          <span className="sidebar__role">{role || "-"}</span>
          <span className="sidebar__role-copy">{roleCopy}</span>
        </div>

        <button type="button" className="sidebar__logout" onClick={logout}>
          Cerrar sesion
        </button>
      </div>
    </aside>
  );
}
