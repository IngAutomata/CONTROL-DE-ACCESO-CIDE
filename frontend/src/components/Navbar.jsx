import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const menuByRole = {
  ADMIN: [
    { to: "/", label: "Inicio", icon: "IN" },
    { to: "/estudiantes", label: "Estudiantes", icon: "ES" },
    { to: "/movimientos", label: "Movimientos", icon: "MV" },
    { to: "/admin", label: "Administraci\u00f3n", icon: "AD" },
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
      ? "Operaci\u00f3n de acceso y monitoreo"
      : "Consulta y seguimiento";
  const roleLabel = role === "ADMIN"
    ? "Rol activo: ADMIN"
    : role === "GUARDA"
      ? "Rol activo: GUARDA"
      : role === "CONSULTA"
        ? "Rol activo: CONSULTA"
        : "Rol activo: -";

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <h1 className="sidebar__wordmark">SIUC</h1>
        <p className="sidebar__submark">Sistema de Ingreso Universidad CIDE</p>
        <p className="sidebar__portal">Portal operativo</p>
      </div>

      <div className="sidebar__toggle" aria-hidden="true">&#9776;</div>

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
          <span className="sidebar__user">{user?.username || "Sin sesi\u00f3n"}</span>
          <span className="sidebar__role">{roleLabel}</span>
          <span className="sidebar__role-copy">{roleCopy}</span>
        </div>

        <button type="button" className="sidebar__logout" onClick={logout}>
          {"Cerrar sesi\u00f3n"}
        </button>
      </div>
    </aside>
  );
}
