import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const r = await api.get("/auth/me");
      setUser(r.data);
    } catch (err) {
      // Stale or missing session — make sure server cookie is gone too
      try { await api.post("/auth/logout"); } catch { /* ignore */ }
      localStorage.removeItem("or_token");
      localStorage.removeItem("or_user");
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // CRITICAL: If returning from Emergent OAuth (session_id in URL fragment),
    // skip the /me probe — AuthCallback will exchange the session_id and
    // establish the cookie first. Otherwise the boot probe races the callback.
    if (typeof window !== "undefined" && window.location.hash && window.location.hash.includes("session_id=")) {
      setLoading(false);
      return;
    }
    refresh();
  }, []);

  const setAuth = (_token, u) => {
    setUser(u);
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    localStorage.removeItem("or_token");
    localStorage.removeItem("or_user");
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, setAuth, logout, loading, refresh }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
