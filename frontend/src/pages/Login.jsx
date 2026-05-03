import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import Navbar from "../components/Navbar";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import PasswordInput from "../components/PasswordInput";
import { toast } from "sonner";

export default function Login() {
  const nav = useNavigate();
  const { setAuth } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      setAuth(data.token, data.user);
      toast.success(`Welcome back, ${data.user.name}.`);
      const dest = data.user.role === "recovery_user" ? "/app" :
                   data.user.role === "supporter" ? "/supporter" : "/clinician";
      nav(dest);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Login failed");
    } finally { setLoading(false); }
  };

  const fillDemo = (em) => { setEmail(em); setPassword("demo1234"); };

  return (
    <div className="min-h-screen ambient-mesh">
      <Navbar />
      <div className="max-w-md mx-auto px-6 py-16">
        <div className="text-[11px] uppercase tracking-[0.22em] text-[#22D3EE] mb-3">Sign in</div>
        <h1 className="font-serif text-4xl tracking-tight text-white">Return to your record.</h1>
        <p className="text-sm text-slate-400 mt-2">Secure, consent-driven access to your longitudinal health data.</p>

        <form onSubmit={submit} className="mt-8 space-y-4 glass rounded-xl p-6" data-testid="login-form">
          <div>
            <Label htmlFor="email" className="text-xs uppercase tracking-wider text-slate-400">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="login-email" className="mt-1 bg-white/5 border-white/10 text-white" />
          </div>
          <div>
            <Label htmlFor="password" className="text-xs uppercase tracking-wider text-slate-400">Password</Label>
            <div className="mt-1">
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                testId="login-password"
              />
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-[#0F766E] hover:bg-[#115e59] text-white shadow-[0_0_24px_rgba(15,118,110,0.35)]" data-testid="login-submit">
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="mt-6 text-sm text-slate-400">
          New here? <Link to="/signup" className="text-[#22D3EE] underline-offset-4 hover:underline">Create account</Link>
        </div>

        <div className="mt-10 glass rounded-xl p-5">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Demo accounts · password demo1234</div>
          <div className="space-y-1">
            {[
              ["Recovery (Alex, improving)", "alex@demo.own"],
              ["Recovery (Morgan, declining)", "morgan@demo.own"],
              ["Supporter (Sam)", "sam@demo.own"],
              ["Clinician (Dr. Quinn, verified)", "drquinn@demo.own"],
            ].map(([lbl, em]) => (
              <button key={em} onClick={() => fillDemo(em)} className="w-full text-left text-xs flex justify-between items-center px-2 py-1.5 rounded hover:bg-white/5 transition-colors" data-testid={`demo-${em}`}>
                <span className="text-slate-300">{lbl}</span>
                <span className="font-mono text-slate-500">{em}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
