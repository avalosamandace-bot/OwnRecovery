import { Button } from "./ui/button";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH

/**
 * Continue-with-Google button using Emergent-managed OAuth.
 * `intendedRole` may be "recovery_user" or "supporter". Clinician is NOT
 * allowed via Google (must use invite-code email signup).
 */
export default function GoogleLoginButton({ intendedRole = "recovery_user", label = "Continue with Google" }) {
  const onClick = () => {
    // Persist intended role so AuthCallback can read it after redirect
    try {
      sessionStorage.setItem("or_google_role", intendedRole === "supporter" ? "supporter" : "recovery_user");
    } catch {
      /* ignore */
    }
    // CRITICAL: derive dynamically from the browser. Do NOT hardcode.
    const redirectUrl = window.location.origin + "/auth/callback";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      data-testid="google-login-btn"
      className="w-full bg-white text-slate-900 hover:bg-slate-100 border-white/10 flex items-center gap-2 justify-center font-medium"
    >
      <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
        <path
          fill="#EA4335"
          d="M12 10.2v3.9h5.5c-.24 1.4-1.66 4.1-5.5 4.1-3.31 0-6-2.74-6-6.1s2.69-6.1 6-6.1c1.88 0 3.14.8 3.86 1.49l2.63-2.53C16.93 3.45 14.7 2.4 12 2.4 6.94 2.4 2.85 6.5 2.85 11.6s4.09 9.2 9.15 9.2c5.28 0 8.78-3.71 8.78-8.93 0-.6-.06-1.06-.15-1.67H12z"
        />
      </svg>
      {label}
    </Button>
  );
}
