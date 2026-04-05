import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const AuthContext = createContext(null);

const TOKEN_KEY = "access_token";
const USER_KEY = "auth_user";
const SESSION_TIMEOUT_MS = 15 * 60 * 1000;
const ACTIVITY_EVENTS = ["click", "keydown", "mousemove", "scroll", "touchstart"];

function readSessionValue(key) {
  return sessionStorage.getItem(key) || localStorage.getItem(key) || "";
}

function clearLegacyLocalStorage() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function apiRequest(url, options = {}, token) {
  const requestUrl = typeof url === "string" && url.startsWith("/") ? `/api${url}` : url;
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(requestUrl, {
    ...options,
    headers,
  });

  const text = await response.text();
  let data = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch (_) {
      data = { error: text };
    }
  }

  if (!response.ok) {
    const error = new Error(data.error || data.message || "Error de autenticacion");
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => readSessionValue(TOKEN_KEY));
  const [user, setUser] = useState(() => {
    const savedUser = readSessionValue(USER_KEY);

    if (!savedUser) return null;

    try {
      return JSON.parse(savedUser);
    } catch (_) {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(Boolean(readSessionValue(TOKEN_KEY)));
  const inactivityTimerRef = useRef(null);

  const clearSession = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    clearLegacyLocalStorage();
  }, []);

  const persistSession = useCallback((nextToken, nextUser) => {
    if (!nextToken || !nextUser) return;
    sessionStorage.setItem(TOKEN_KEY, nextToken);
    sessionStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    clearLegacyLocalStorage();
  }, []);

  const clearInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      window.clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  const logout = useCallback(() => {
    clearSession();
    clearInactivityTimer();
    setToken("");
    setUser(null);
  }, [clearInactivityTimer, clearSession]);

  const scheduleInactivityLogout = useCallback(() => {
    clearInactivityTimer();

    if (!token) return;

    inactivityTimerRef.current = window.setTimeout(() => {
      logout();
    }, SESSION_TIMEOUT_MS);
  }, [clearInactivityTimer, logout, token]);

  const refreshUser = useCallback(async ({ soft = false } = {}) => {
    if (!token) return null;

    try {
      const data = await apiRequest("/auth/me", {}, token);
      persistSession(token, data);
      setUser(data);
      return data;
    } catch (error) {
      if (!soft && (error.status === 401 || error.status === 403)) {
        logout();
      }

      throw error;
    }
  }, [logout, persistSession, token]);

  const login = useCallback(async (username, password) => {
    setLoading(true);

    try {
      const data = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });

      persistSession(data.token, data.user);
      setToken(data.token);
      setUser(data.user);

      return data.user;
    } finally {
      setLoading(false);
    }
  }, [persistSession]);

  const authorizedRequest = useCallback((url, options = {}) => {
    return apiRequest(url, options, token);
  }, [token]);

  useEffect(() => {
    clearLegacyLocalStorage();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!token) {
        setBootstrapping(false);
        return;
      }

       if (user) {
        setBootstrapping(false);

        try {
          await refreshUser({ soft: true });
        } catch (error) {
          if (error.status !== 401 && error.status !== 403) {
            console.warn("No se pudo revalidar la sesion al recargar", error);
          }
        }

        return;
      }

      try {
        await refreshUser({ soft: true });
      } catch (error) {
        if (error.status === 401 || error.status === 403) {
          logout();
        } else {
          console.warn("No se pudo revalidar la sesion al iniciar", error);
        }
      } finally {
        if (!cancelled) {
          setBootstrapping(false);
        }
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [refreshUser, token]);

  useEffect(() => {
    if (!token) {
      clearInactivityTimer();
      return undefined;
    }

    const registerActivity = () => {
      scheduleInactivityLogout();
    };

    scheduleInactivityLogout();
    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, registerActivity, { passive: true });
    });

    return () => {
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, registerActivity);
      });
      clearInactivityTimer();
    };
  }, [clearInactivityTimer, scheduleInactivityLogout, token]);

  const value = useMemo(
    () => ({
      user,
      token,
      role: user?.role || null,
      isAuthenticated: Boolean(token && user),
      loading,
      ready: !bootstrapping,
      login,
      logout,
      refreshUser,
      apiRequest: authorizedRequest,
    }),
    [authorizedRequest, bootstrapping, loading, login, logout, refreshUser, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }

  return context;
}
