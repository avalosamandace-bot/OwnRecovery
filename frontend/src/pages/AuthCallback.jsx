import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { toast } from "sonner";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH

export default function AuthCallback() {
  const nav = useNavigate();
  const { setAuth } = useAuth();
  const hasProcessed = useRef(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = window.location.hash || "";
    const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
    const sessionId = params.get("session_id");
    const intendedRole = params.get("role") || sessionStorage.getItem("or_google_role") || "recovery_user";

    if (!sessionId) {
      setError("Missing session id");
      setTimeout(() => nav("/login", { replace: true }), 1200);
      return;
    }

    (async () => {
      try {
        const { data } = await api.post("/auth/google", {
          session_id: sessionId,
          role: intendedRole === "supporter" ? "supporter" : "recovery_user",
        });
        setAuth(data.token, data.user);
        sessionStorage.removeItem("or_google_role");
        // Clear the fragment from the URL
        window.history.replaceState({}, document.title, window.location.pathname);
        toast.success(`Welcome, ${data.user.name}.`);
        const dest =
          data.user.role === "recovery_user"
            ? "/app"
            : data.user.role === "supporter"
            ? "/supporter"
            : "/clinician";
        nav(dest, { replace: true, state: { user: data.user } });
      } catch (err) {
        const detail = err?.response?.data?.detail || "Google sign-in failed.";
        setError(detail);
        toast.error(detail);
        setTimeout(() => nav("/login", { replace: true }), 1500);
      }
    })();
  }, [nav, setAuth]);

  return (
    <div
      className="min-h-screen ambient-mesh flex items-center justify-center text-slate-300"
      data-testid="auth-callback"
    >
      <div className="text-center space-y-3">
        <div className="text-[11px] uppercase tracking-[0.22em] text-[#22D3EE]">
          {error ? "Authentication error" : "Verifying Google session"}
        </div>
        <div className="font-serif text-2xl text-white">
          {error ? error : "Completing your sign-in…"}
        </div>
        {!error && (
          <div className="text-xs text-slate-500">Connecting to your record</div>
        )}
      </div>
    </div>
  );
}
