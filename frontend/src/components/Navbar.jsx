import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui/button";
import { LogOut, Activity, BadgeCheck } from "lucide-react";

const roleLabel = (r) => ({
  recovery_user: "Recovery",
  supporter: "Supporter",
  clinician: "Clinician",
}[r] || r);

export default function Navbar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  const handleLogout = async () => { await logout(); nav("/"); };

  const links = () => {
    if (!user) return null;
    if (user.role === "recovery_user") return (
      <>
        <Link to="/app" className="text-sm text-slate-400 hover:text-white transition-colors" data-testid="nav-dashboard">Command</Link>
        <Link to="/app/checkin" className="text-sm text-slate-400 hover:text-white transition-colors" data-testid="nav-checkin">Check-in</Link>
        <Link to="/app/trends" className="text-sm text-slate-400 hover:text-white transition-colors" data-testid="nav-trends">Trends</Link>
        <Link to="/app/summary" className="text-sm text-slate-400 hover:text-white transition-colors" data-testid="nav-summary">Weekly</Link>
        <Link to="/app/privacy" className="text-sm text-slate-400 hover:text-white transition-colors" data-testid="nav-privacy">Privacy</Link>
      </>
    );
    if (user.role === "supporter") return (
      <Link to="/supporter" className="text-sm text-slate-400 hover:text-white transition-colors" data-testid="nav-supporter">Connections</Link>
    );
    if (user.role === "clinician") return (
      <Link to="/clinician" className="text-sm text-slate-400 hover:text-white transition-colors" data-testid="nav-clinician">Patient Panel</Link>
    );
    return null;
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0B1220]/70 backdrop-blur-xl border-b border-white/5" data-testid="navbar">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to={user ? (user.role === "recovery_user" ? "/app" : user.role === "supporter" ? "/supporter" : "/clinician") : "/"} className="flex items-center gap-2.5 group" data-testid="brand">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0F766E] via-[#22D3EE] to-[#4F46E5] flex items-center justify-center shadow-[0_0_24px_rgba(34,211,238,0.25)]">
            <Activity className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-xl tracking-tight text-white">Own Recovery</span>
            <span className="hidden md:inline text-[10px] uppercase tracking-[0.22em] text-slate-500">AI Clinical Intelligence</span>
          </div>
        </Link>

        <nav className="flex items-center gap-5">
          {links()}
          {user ? (
            <div className="flex items-center gap-3">
              {user.role === "clinician" && user.verified_clinician && (
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-[#0F766E]/20 border border-[#0F766E]/40 text-[#5EEAD4]" data-testid="verified-badge">
                  <BadgeCheck className="w-3 h-3" /> Verified
                </span>
              )}
              <span className="text-xs text-slate-500 hidden sm:inline" data-testid="user-role">{roleLabel(user.role)} · {user.name}</span>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-400 hover:text-white hover:bg-white/5" data-testid="logout-btn">
                <LogOut className="w-4 h-4 mr-1" /> Sign out
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login"><Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-white/5" data-testid="nav-login">Sign in</Button></Link>
              <Link to="/signup"><Button size="sm" className="bg-[#0F766E] hover:bg-[#115e59] text-white shadow-[0_0_24px_rgba(15,118,110,0.35)]" data-testid="nav-signup">Get started</Button></Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
