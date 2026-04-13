import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("Frontend render error", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="auth-shell">
          <section className="auth-card auth-card--loading error-boundary-card">
            <p className="eyebrow">Error de interfaz</p>
            <h2>No pudimos cargar la aplicación</h2>
            <p className="auth-copy">
              Ocurrió un error al renderizar la pantalla. Recarga la página y, si
              persiste, comparte este mensaje con el equipo.
            </p>
            <div className="form-error error-boundary-message">
              {this.state.error?.message || "Error desconocido en el frontend."}
            </div>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
