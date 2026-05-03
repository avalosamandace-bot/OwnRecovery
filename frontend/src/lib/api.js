import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  withCredentials: true,  // send HttpOnly cookie
});

// Legacy fallback header (optional — cookie is primary)
api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem("or_token");
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem("or_token");
      localStorage.removeItem("or_user");
    }
    return Promise.reject(err);
  }
);
