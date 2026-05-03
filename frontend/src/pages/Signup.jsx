import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import Navbar from "../components/Navbar";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { Checkbox } from "../components/ui/checkbox";
import PasswordInput from "../components/PasswordInput";
import GoogleLoginButton from "../components/GoogleLoginButton";
import { toast } from "sonner";
import { Heart, Lock, Activity, Users, Eye, BadgeCheck, AlertTriangle } from "lucide-react";

const ROLES = [
  { v: "recovery_user", t: "Recovery User", Icon: Activity, d: "I am tracking my own recovery signals." },
  { v: "supporter", t: "Supporter", Icon: Users, d: "I support a loved one and receive consented alerts." },
  { v: "clinician", t: "Clinician", Icon: Eye, d: "I observe population-level trends (invite code required)." },
];

export default function Signup() {
  const nav = useNavigate();
  const { setAuth } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("recovery_user");
  const [inviteCode, setInviteCode] = useState("");
  const [organization, setOrganization] = useState("");
  const [license, setLicense] = useState("");
  const [guided, setGuided] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const body = { name, email, password, role };
      if (role === "clinician") {
        body.clinician_invite_code = inviteCode.trim();
        body.organization = organization || null;
        body.license_number = license || null;
      }
      const { data } = await api.post("/auth/signup", body);
      setAuth(data.token, data.user);
      toast.success("Account created. Welcome.");
      if (role === "recovery_user" && guided) {
        nav("/app/onboarding");
      } else {
        const dest = role === "recovery_user" ? "/app" : role === "supporter" ? "/supporter" : "/clinician";
        nav(dest);
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Signup failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen ambient-mesh">
      <Navbar />
      <div className="max-w-md mx-auto px-6 py-12">
        <div className="text-[11px] uppercase tracking-[0.22em] text-[#22D3EE] mb-3">Create account</div>
        <h1 className="font-serif text-4xl tracking-tight text-white">Begin your clinical record.</h1>
        <p className="text-sm text-slate-400 mt-2">Takes a minute. Your data stays yours.</p>

        <form onSubmit={submit} className="mt-8 space-y-5 glass rounded-xl p-6" data-testid="signup-form">
          <div>
            <Label className="text-xs uppercase tracking-wider text-slate-400">Role</Label>
            <RadioGroup value={role} onValueChange={setRole} className="mt-2 space-y-2">
              {ROLES.map((r) => (
                <label key={r.v} htmlFor={`r-${r.v}`} className={`flex gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${role === r.v ? "border-[#0F766E]/60 bg-[#0F766E]/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`} data-testid={`role-${r.v}`}>
                  <RadioGroupItem id={`r-${r.v}`} value={r.v} className="mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <r.Icon className="w-4 h-4 text-[#22D3EE]" />
                      <div className="text-sm font-medium text-white">{r.t}</div>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{r.d}</div>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          {role === "recovery_user" && (
            <label className="flex items-start gap-3 rounded-lg border border-[#22D3EE]/25 bg-[#22D3EE]/5 p-4 cursor-pointer hover:bg-[#22D3EE]/10 transition-colors" data-testid="guided-toggle">
              <Checkbox checked={guided} onCheckedChange={(v) => setGuided(!!v)} className="mt-0.5" />
              <div>
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-[#22D3EE]" />
                  <div className="text-sm font-medium text-white">I want help but don't know where to start</div>
                </div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">A gentle four-question onboarding. We'll generate a supportive Day 1 plan — no clinical pressure.</p>
              </div>
            </label>
          )}

          <div>
            <Label htmlFor="name" className="text-xs uppercase tracking-wider text-slate-400">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required data-testid="signup-name" className="mt-1 bg-white/5 border-white/10 text-white" />
          </div>
          <div>
            <Label htmlFor="email" className="text-xs uppercase tracking-wider text-slate-400">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="signup-email" className="mt-1 bg-white/5 border-white/10 text-white" />
          </div>
          <div>
            <Label htmlFor="password" className="text-xs uppercase tracking-wider text-slate-400">Password</Label>
            <div className="mt-1">
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                testId="signup-password"
              />
            </div>
          </div>

          {role === "clinician" && (
            <div className="space-y-3 rounded-lg border border-[#4F46E5]/30 bg-[#4F46E5]/5 p-4" data-testid="clinician-fields">
              <div className="flex items-start gap-2 text-xs text-indigo-200">
                <BadgeCheck className="w-4 h-4 mt-0.5 shrink-0" />
                <div>Clinician accounts require a valid invite code. Public signup cannot create one.</div>
              </div>
              <div>
                <Label htmlFor="invite" className="text-xs uppercase tracking-wider text-slate-400">Invite code</Label>
                <Input id="invite" value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())} required data-testid="invite-code" className="mt-1 bg-white/5 border-white/10 text-white font-mono" placeholder="CLINICIAN-DEMO-2026" />
              </div>
              <div>
                <Label htmlFor="org" className="text-xs uppercase tracking-wider text-slate-400">Organization (optional)</Label>
                <Input id="org" value={organization} onChange={(e) => setOrganization(e.target.value)} data-testid="org-input" className="mt-1 bg-white/5 border-white/10 text-white" />
              </div>
              <div>
                <Label htmlFor="lic" className="text-xs uppercase tracking-wider text-slate-400">License number (optional, simulated)</Label>
                <Input id="lic" value={license} onChange={(e) => setLicense(e.target.value)} data-testid="license-input" className="mt-1 bg-white/5 border-white/10 text-white font-mono" />
              </div>
              <div className="text-[11px] text-amber-300 flex items-start gap-2 border-t border-white/5 pt-3">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>Clinician verification in this demo is simulated. Real systems require credential verification.</span>
              </div>
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full bg-[#0F766E] hover:bg-[#115e59] text-white shadow-[0_0_24px_rgba(15,118,110,0.35)]" data-testid="signup-submit">
            {loading ? "Creating…" : "Create account"}
          </Button>

          {role !== "clinician" && (
            <>
              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-[0.22em]">
                  <span className="bg-transparent px-2 text-slate-500">or</span>
                </div>
              </div>
              <GoogleLoginButton
                intendedRole={role === "supporter" ? "supporter" : "recovery_user"}
                label={`Continue with Google as ${role === "supporter" ? "Supporter" : "Recovery User"}`}
              />
              <p className="text-[11px] text-slate-500 text-center">
                Google sign-in skips the password step. Your role is recorded as selected above.
              </p>
            </>
          )}

          <div className="text-[11px] text-slate-500 flex items-center gap-2 pt-2 border-t border-white/5">
            <Lock className="w-3 h-3" />
            Passwords are bcrypt-hashed. Sessions use HttpOnly, Secure cookies.
          </div>
        </form>

        <div className="mt-6 text-sm text-slate-400">
          Already registered? <Link to="/login" className="text-[#22D3EE] underline-offset-4 hover:underline">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
