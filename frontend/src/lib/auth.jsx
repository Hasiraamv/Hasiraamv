import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, setAuthToken } from "./api";

const AuthContext = createContext(null);

const TOKEN_KEY = "fitpocket_token";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | authenticated | guest
  const [error, setError] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) setAuthToken(stored);

    api.auth
      .me()
      .then((data) => {
        setUser(data.user);
        setStatus("authenticated");
      })
      .catch(() => {
        setAuthToken(null);
        localStorage.removeItem(TOKEN_KEY);
        setStatus("guest");
      });
  }, []);

  const persistSession = useCallback((data) => {
    if (data.token) {
      setAuthToken(data.token);
      localStorage.setItem(TOKEN_KEY, data.token);
    }
    setUser(data.user);
    setStatus("authenticated");
  }, []);

  const login = useCallback(
    async (email, password) => {
      setError(null);
      try {
        const data = await api.auth.login({ email, password });
        persistSession(data);
        return true;
      } catch (e) {
        setError(e.message);
        return false;
      }
    },
    [persistSession]
  );

  const register = useCallback(
    async (name, email, password) => {
      setError(null);
      try {
        const data = await api.auth.register({ name, email, password });
        persistSession(data);
        return true;
      } catch (e) {
        setError(e.message);
        return false;
      }
    },
    [persistSession]
  );

  const loginWithGoogle = useCallback(
    async (credential) => {
      setError(null);
      try {
        const data = await api.auth.google(credential);
        persistSession(data);
        return true;
      } catch (e) {
        setError(e.message);
        return false;
      }
    },
    [persistSession]
  );

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      /* ignore network errors on logout */
    }
    setAuthToken(null);
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setStatus("guest");
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, error, setError, login, register, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
