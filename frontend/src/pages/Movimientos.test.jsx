import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import Movimientos from "./Movimientos.jsx";

const authMock = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

vi.mock("../context/AuthContext.jsx", () => authMock);
vi.mock("../components/QrScanner.jsx", () => ({
  default: function QrScannerMock() {
    return <div data-testid="qr-scanner-mock">scanner</div>;
  },
}));

describe("Movimientos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("valida el formato del QR antes de registrar", async () => {
    const apiRequest = vi.fn((path) => {
      if (path === "/movimientos/dentro-campus") return Promise.resolve({ estudiantes: [] });
      if (path === "/movimientos") return Promise.resolve({ movimientos: [] });
      return Promise.reject(new Error(`Ruta no mockeada: ${path}`));
    });

    authMock.useAuth.mockReturnValue({
      role: "ADMIN",
      apiRequest,
    });

    render(
      <MemoryRouter>
        <Movimientos />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith("/movimientos/dentro-campus");
      expect(apiRequest).toHaveBeenCalledWith("/movimientos");
    });

    fireEvent.change(screen.getByPlaceholderText(/https:\/\/soe.cide.edu.co\/verificar-estudiante/i), {
      target: { value: "qr-invalido" },
    });
    fireEvent.click(screen.getByRole("button", { name: /registrar/i }));

    expect(
      await screen.findByText(/el qr debe tener formato cide/i)
    ).toBeInTheDocument();
  });

  it("registra por c\u00e9dula usando el popup de selección de moto y actualiza la \u00faltima lectura", async () => {
    const apiRequest = vi.fn((path, options) => {
      if (path === "/movimientos/dentro-campus") {
        if (options?.method === "POST") {
          return Promise.resolve({ estudiantes: [] });
        }
        return Promise.resolve({
          estudiantes: [
            {
              estudiante_id: 10,
              nombre: "Luis Prueba",
              documento: "12345678",
              placa: "ABC12D",
              fecha_ultimo_movimiento: "2026-04-13T10:00:00.000Z",
              actor_username: "admin",
            },
          ],
        });
      }
      if (path === "/movimientos") {
        return Promise.resolve({ movimientos: [] });
      }
      if (path === "/estudiantes/documento/12345678") {
        return Promise.resolve({
          estudiante: {
            id: 10,
            nombre: "Luis Prueba",
            documento: "12345678",
            placa: "ABC12D",
            color: "Negra",
            placa_secundaria: "XYZ34K",
            color_secundaria: "Roja",
          },
        });
      }
      if (path === "/movimientos/registrar") {
        expect(options?.method).toBe("POST");
        expect(options?.body).toContain('"documento":"12345678"');
        expect(options?.body).toContain('"placa":"ABC12D"');
        return Promise.resolve({
          movimiento: {
            tipo: "ENTRADA",
            fecha_hora: "2026-04-13T10:00:00.000Z",
            actor_username: "admin",
            vehiculo_placa: "ABC12D",
          },
          estudiante: {
            nombre: "Luis Prueba",
            documento: "12345678",
            qr_uid: "https://soe.cide.edu.co/verificar-estudiante/NjEyMzE2",
            updated_by_username: "admin",
          },
        });
      }
      return Promise.reject(new Error(`Ruta no mockeada: ${path}`));
    });

    authMock.useAuth.mockReturnValue({
      role: "ADMIN",
      apiRequest,
    });

    render(
      <MemoryRouter>
        <Movimientos />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith("/movimientos/dentro-campus");
      expect(apiRequest).toHaveBeenCalledWith("/movimientos");
    });

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "documento" } });
    fireEvent.change(screen.getByPlaceholderText(/c\u00e9dula de 8 a 10 d\u00edgitos/i), {
      target: { value: "12345678" },
    });
    fireEvent.click(screen.getByRole("button", { name: /registrar/i }));
    expect(await screen.findByRole("heading", { name: /confirmar ingreso o salida por cédula/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /moto principal/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirmar movimiento/i }));

    expect(await screen.findByText(/entrada registrada para luis prueba/i)).toBeInTheDocument();
    expect(screen.getByText(/responsable: admin/i)).toBeInTheDocument();
    expect(screen.getAllByText(/placa: abc12d/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/luis prueba/i).length).toBeGreaterThan(0);
  });

  it("resuelve el estudiante por cédula al enviar aunque el guardado sea rápido", async () => {
    const apiRequest = vi.fn((path, options) => {
      if (path === "/movimientos/dentro-campus") return Promise.resolve({ estudiantes: [] });
      if (path === "/movimientos") return Promise.resolve({ movimientos: [] });
      if (path === "/estudiantes/documento/1016833755") {
        return Promise.resolve({
          estudiante: {
            id: 22,
            nombre: "Carlos Fernando Murcia Olivares",
            documento: "1016833755",
            placa: "WSC50H",
            color: "Negra",
            placa_secundaria: null,
            color_secundaria: null,
          },
        });
      }
      if (path === "/movimientos/registrar") {
        expect(options?.body).toContain('"documento":"1016833755"');
        expect(options?.body).toContain('"placa":"WSC50H"');
        return Promise.resolve({
          movimiento: {
            tipo: "SALIDA",
            fecha_hora: "2026-04-16T14:15:00.000Z",
            actor_username: "admin",
            vehiculo_placa: "WSC50H",
          },
          estudiante: {
            nombre: "Carlos Fernando Murcia Olivares",
            documento: "1016833755",
            qr_uid: "https://soe.cide.edu.co/verificar-estudiante/NjEyMzE2",
            updated_by_username: "admin",
          },
        });
      }
      return Promise.reject(new Error(`Ruta no mockeada: ${path}`));
    });

    authMock.useAuth.mockReturnValue({
      role: "ADMIN",
      apiRequest,
    });

    render(
      <MemoryRouter>
        <Movimientos />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith("/movimientos/dentro-campus");
      expect(apiRequest).toHaveBeenCalledWith("/movimientos");
    });

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "documento" } });
    fireEvent.change(screen.getByPlaceholderText(/c\u00e9dula de 8 a 10 d\u00edgitos/i), {
      target: { value: "1016833755" },
    });
    fireEvent.click(screen.getByRole("button", { name: /registrar/i }));
    expect(await screen.findByRole("heading", { name: /confirmar ingreso o salida por cédula/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /moto principal/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirmar movimiento/i }));

    expect(await screen.findByText(/salida registrada para carlos fernando murcia olivares/i)).toBeInTheDocument();
    expect(screen.queryByText(/primero debes consultar una cédula válida/i)).not.toBeInTheDocument();
  });

  it("por c\u00e9dula obliga novedad si entra con una moto no registrada", async () => {
    const apiRequest = vi.fn((path, options) => {
      if (path === "/movimientos/dentro-campus") return Promise.resolve({ estudiantes: [] });
      if (path === "/movimientos") return Promise.resolve({ movimientos: [] });
      if (path === "/estudiantes/documento/12345678") {
        return Promise.resolve({
          estudiante: {
            id: 10,
            nombre: "Luis Prueba",
            documento: "12345678",
            placa: "ABC12D",
            placa_secundaria: "XYZ34K",
          },
        });
      }
      if (path === "/movimientos/registrar") {
        expect(options?.body).toContain('"documento":"12345678"');
        expect(options?.body).toContain('"placa":"ZZZ99Z"');
        expect(options?.body).toContain('"motivo":"Vehículo alterno del estudiante"');
        return Promise.resolve({
          movimiento: {
            tipo: "ENTRADA",
            fecha_hora: "2026-04-16T08:00:00.000Z",
            actor_username: "admin",
            vehiculo_placa: "ZZZ99Z",
          },
          estudiante: {
            nombre: "Luis Prueba",
            documento: "12345678",
            qr_uid: "-",
            updated_by_username: "admin",
          },
          novedad: {
            placa_observada: "ZZZ99Z",
            motivo: "Vehículo alterno del estudiante",
            tipo_soporte: "RUNT",
          },
        });
      }
      return Promise.reject(new Error(`Ruta no mockeada: ${path}`));
    });

    authMock.useAuth.mockReturnValue({
      role: "ADMIN",
      apiRequest,
    });

    render(
      <MemoryRouter>
        <Movimientos />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith("/movimientos/dentro-campus");
      expect(apiRequest).toHaveBeenCalledWith("/movimientos");
    });

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "documento" } });
    fireEvent.change(screen.getByPlaceholderText(/c\u00e9dula de 8 a 10 d\u00edgitos/i), {
      target: { value: "12345678" },
    });
    fireEvent.click(screen.getByRole("button", { name: /registrar/i }));
    expect(await screen.findByRole("heading", { name: /confirmar ingreso o salida por cédula/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /otra moto no registrada/i }));
    fireEvent.change(screen.getByPlaceholderText(/placa abc12d/i), {
      target: { value: "zzz99z" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /soporte validado con/i }), {
      target: { value: "RUNT" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /confirmo que el estudiante presentó/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirmar movimiento/i }));

    expect(await screen.findByText(/entrada registrada para luis prueba/i)).toBeInTheDocument();
    expect(screen.getByText(/novedad: vehículo alterno del estudiante · runt/i)).toBeInTheDocument();
  });

  it("valida la novedad antes de enviar el registro por placa", async () => {
    const apiRequest = vi.fn((path) => {
      if (path === "/movimientos/dentro-campus") return Promise.resolve({ estudiantes: [] });
      if (path === "/movimientos") return Promise.resolve({ movimientos: [] });
      return Promise.reject(new Error(`Ruta no mockeada: ${path}`));
    });

    authMock.useAuth.mockReturnValue({
      role: "ADMIN",
      apiRequest,
    });

    render(
      <MemoryRouter>
        <Movimientos />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith("/movimientos/dentro-campus");
      expect(apiRequest).toHaveBeenCalledWith("/movimientos");
    });

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "placa" } });
    fireEvent.change(screen.getByPlaceholderText(/placa abc12d/i), {
      target: { value: "zzz99z" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /registrar ingreso con novedad/i }));
    fireEvent.change(screen.getByPlaceholderText(/c\u00e9dula del estudiante/i), {
      target: { value: "12345678" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /motivo/i }), {
      target: { value: "Otro" },
    });
    fireEvent.click(screen.getByRole("button", { name: /registrar/i }));

    expect(await screen.findByText(/debes confirmar que validaste la tarjeta/i)).toBeInTheDocument();
    expect(apiRequest).not.toHaveBeenCalledWith(
      "/movimientos/registrar",
      expect.anything()
    );
  });

  it("registra ingreso con novedad y muestra el resumen", async () => {
    const apiRequest = vi.fn((path, options) => {
      if (path === "/movimientos/dentro-campus") {
        return Promise.resolve({ estudiantes: [] });
      }
      if (path === "/movimientos") {
        return Promise.resolve({ movimientos: [] });
      }
      if (path === "/movimientos/registrar") {
        expect(options?.method).toBe("POST");
        expect(options?.body).toContain('"placa":"ZZZ99Z"');
        expect(options?.body).toContain('"documento":"12345678"');
        expect(options?.body).toContain('"motivo":"Vehículo alterno del estudiante"');
        return Promise.resolve({
          movimiento: {
            tipo: "ENTRADA",
            fecha_hora: "2026-04-16T08:00:00.000Z",
            actor_username: "admin",
          },
          estudiante: {
            nombre: "Laura Novedad",
            documento: "12345678",
            placa: "ABC12D",
            qr_uid: "-",
            updated_by_username: "admin",
          },
          novedad: {
            placa_observada: "ZZZ99Z",
            motivo: "Vehículo alterno del estudiante",
            tipo_soporte: "RUNT",
          },
        });
      }
      return Promise.reject(new Error(`Ruta no mockeada: ${path}`));
    });

    authMock.useAuth.mockReturnValue({
      role: "ADMIN",
      apiRequest,
    });

    render(
      <MemoryRouter>
        <Movimientos />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith("/movimientos/dentro-campus");
      expect(apiRequest).toHaveBeenCalledWith("/movimientos");
    });

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "placa" } });
    fireEvent.change(screen.getByPlaceholderText(/placa abc12d/i), {
      target: { value: "zzz99z" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /registrar ingreso con novedad/i }));
    fireEvent.change(screen.getByPlaceholderText(/c\u00e9dula del estudiante/i), {
      target: { value: "12345678" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /soporte validado con/i }), {
      target: { value: "RUNT" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /confirmo que el estudiante present\u00f3/i }));
    fireEvent.click(screen.getByRole("button", { name: /registrar/i }));

    expect(await screen.findByText(/entrada registrada para laura novedad/i)).toBeInTheDocument();
    expect(screen.getByText(/novedad: veh\u00edculo alterno del estudiante · runt/i)).toBeInTheDocument();
  });

  it("oculta el bloque de registro para consulta", async () => {
    const apiRequest = vi.fn((path) => {
      if (path === "/movimientos/dentro-campus") return Promise.resolve({ estudiantes: [] });
      if (path === "/movimientos") return Promise.resolve({ movimientos: [] });
      return Promise.reject(new Error(`Ruta no mockeada: ${path}`));
    });

    authMock.useAuth.mockReturnValue({
      role: "CONSULTA",
      apiRequest,
    });

    render(
      <MemoryRouter>
        <Movimientos />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: /hist\u00f3rico de movimientos/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /registrar entrada o salida/i })).not.toBeInTheDocument();
  });
});

