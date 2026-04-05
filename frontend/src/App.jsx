import { Navigate, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Login from "./pages/Login.jsx";
import Movimientos from "./pages/Movimientos.jsx";
import Admin from "./pages/Admin.jsx";
import Estudiantes from "./pages/Estudiantes.jsx";
import ProtectedRoute from "./routes/ProtectedRoute.jsx";

export default function App() {
  const { isAuthenticated, ready, role, user } = useAuth();

  if (!ready) {
    return (
      <main className="auth-shell">
        <section className="auth-card auth-card--loading">
          <p className="eyebrow">Cargando</p>
          <h2>Verificando sesión</h2>
          <p className="auth-copy">
            Estamos comprobando tu acceso para cargar el módulo correcto según tu rol.
          </p>
        </section>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="layout">
      <Navbar />

      <main className="content">
        <div className="content__banner">
          <span className="content__banner-icon">i</span>
          <strong>Portal operativo SIUC</strong>
          <span>{`${user?.username || "Sesión activa"} · ${role || "Sin rol"} · El acceso visible depende del rol autenticado.`}</span>
        </div>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Dashboard />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={["ADMIN", "GUARDA", "CONSULTA"]} />}>
            <Route path="/estudiantes" element={<Estudiantes />} />
            <Route path="/movimientos" element={<Movimientos />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={["ADMIN"]} />}>
            <Route path="/admin" element={<Admin />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
