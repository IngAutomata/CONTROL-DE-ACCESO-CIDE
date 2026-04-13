import React from "react";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import ErrorBoundary from "./ErrorBoundary.jsx";

function BrokenComponent() {
  throw new Error("Fallo controlado");
}

describe("ErrorBoundary", () => {
  const originalError = console.error;

  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalError;
  });

  it("muestra mensaje amigable cuando una pantalla falla", () => {
    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText(/no pudimos cargar la aplicación/i)).toBeInTheDocument();
    expect(screen.getByText(/fallo controlado/i)).toBeInTheDocument();
  });
});
