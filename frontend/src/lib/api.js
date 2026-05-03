import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  withCredentials: true,  // send HttpOnly cookie
});

// Routes that should NOT trigger a forced logout-redirect on 401 (e.g. the auth boot probe itself)
const SILENT_401 = ["/auth/me", "/auth/login", "/auth/signup", "/auth/google", "/auth/logout"];

api.interceptors.request.use((cfg) => {
  // Legacy fallback header — cookie is primary
  const t = localStorage.getItem("or_token");
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err?.response?.status;
    const url = err?.config?.url || "";
    if (status === 401) {
      // Always clear local mirror
      localStorage.removeItem("or_token");
      localStorage.removeItem("or_user");
      // For NON-silent paths, force a clean trip back to /login.
      // The backend has already cleared the HttpOnly cookie via Set-Cookie on the failed request.
      const silent = SILENT_401.some((p) => url.includes(p));
      if (!silent && typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        // Best-effort cookie clear too
        api.post("/auth/logout").catch(() => {});
        window.location.replace("/login");
      }
    }
    return Promise.reject(err);
  }
);
