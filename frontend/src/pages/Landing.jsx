import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { ShieldCheck, LineChart, Brain, Users, Lock, ArrowRight, Activity, Sparkles, Eye } from "lucide-react";
import Navbar from "../components/Navbar";

export default function Landing() {
  return (
    <div className="min-h-screen ambient-mesh">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="grain-overlay" />
        <div className="max-w-7xl mx-auto px-6 pt-20 lg:pt-28 pb-16 lg:pb-20 grid lg:grid-cols-12 gap-12 relative">
          <div className="lg:col-span-7 fade-up">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#22D3EE]/20 bg-[#22D3EE]/5 text-[11px] uppercase tracking-[0.22em] text-[#22D3EE]" data-testid="hero-badge">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22D3EE] pulse-ring" />
              Clinical Decision Support · Not Diagnosis
            </div>
            <h1 className="mt-6 font-serif text-5xl lg:text-7xl tracking-tight leading-[1.02] text-white" data-testid="hero-title">
              Explainable AI for<br />behavioral health<br />
              <span className="italic bg-gradient-to-r from-[#22D3EE] via-[#0F766E] to-[#4F46E5] bg-clip-text text-transparent">recovery monitoring.</span>
            </h1>
            <p className="mt-8 text-lg text-slate-400 leading-relaxed max-w-2xl" data-testid="hero-subtitle">
              Own Recovery is a lightweight clinical decision-support system. It tracks longitudinal
              health signals — mood, sleep, stress, cravings, triggers — and returns a transparent
              relapse-risk score with a full explanation of every contributing factor.
            </p>
            <p className="mt-4 text-base text-slate-500 max-w-2xl">
              Designed for human-in-the-loop care. AI suggests. A human reviews. A human acts.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link to="/signup">
                <Button className="bg-[#0F766E] hover:bg-[#115e59] text-white h-11 px-6 shadow-[0_0_32px_rgba(15,118,110,0.4)]" data-testid="cta-primary">
                  Start monitoring <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="outline" className="h-11 px-6 border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white" data-testid="cta-secondary">
                  Sign in to dashboard
                </Button>
              </Link>
              <div className="text-xs text-slate-500 ml-2 hidden sm:block">
                Demo: <span className="font-mono text-slate-300">alex@demo.own</span> / <span className="font-mono text-slate-300">demo1234</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 fade-up">
            <div className="glass rounded-xl p-6 relative overflow-hidden gradient-border">
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#22D3EE]/15 blur-3xl rounded-full" />
              <div className="text-[10px] uppercase tracking-[0.25em] text-[#22D3EE] mb-3 relative">Sample reading · Day 14</div>
              <div className="flex items-baseline gap-3 relative">
                <div className="font-serif text-6xl text-white">62</div>
                <div className="text-sm text-slate-500">/ 100 risk</div>
              </div>
              <div className="mt-1 inline-flex text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 relative">Medium risk</div>
              <div className="mt-5 space-y-2.5 relative">
                {[
                  { label: "Craving intensity", v: "+21" },
                  { label: "Sleep 5.2h (deficit)", v: "+15" },
                  { label: "Stress 7", v: "+13" },
                  { label: "Mood 6", v: "+6" },
                  { label: "Triggers (1)", v: "+5" },
                ].map((r, i) => {
                  const n = parseInt(r.v.replace(/[^0-9]/g,""));
                  return (
                    <div key={r.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-300">{r.label}</span>
                        <span className="font-mono text-white">{r.v}</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-rose-500 to-rose-400 rounded-full" style={{ width: `${n * 3}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 text-xs text-slate-400 border-t border-white/5 pt-3 italic relative">
                "Today's risk is driven by: Craving intensity +21; Sleep 5.2h +15; Stress +13."
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-20 lg:py-24">
          <div className="max-w-3xl">
            <div className="text-[11px] uppercase tracking-[0.22em] text-[#22D3EE] mb-3">How it works</div>
            <h2 className="font-serif text-4xl lg:text-5xl tracking-tight text-white leading-tight">
              Structured data. Transparent models. Human oversight.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4 mt-12">
            {[
              { n: "01", Icon: Activity, t: "Longitudinal check-ins", d: "Mood, cravings, sleep hours, stress, and trigger events are logged daily into a structured health record." },
              { n: "02", Icon: Brain, t: "Dual risk models", d: "A clinically-weighted rule-based engine is primary. A scikit-learn logistic regression runs alongside for comparison." },
              { n: "03", Icon: Sparkles, t: "Feature-level explanation", d: "Every score is decomposed. You see exactly which factor contributed how many points, and why." },
            ].map((s) => (
              <div key={s.n} className="glass rounded-xl p-7">
                <div className="flex items-center gap-3 text-slate-500 text-xs font-mono">{s.n} <s.Icon className="w-4 h-4 text-[#22D3EE]" /></div>
                <h3 className="mt-5 text-lg font-medium text-white">{s.t}</h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section className="border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-20 lg:py-24">
          <div className="grid lg:grid-cols-12 gap-12">
            <div className="lg:col-span-4">
              <div className="text-[11px] uppercase tracking-[0.22em] text-[#22D3EE] mb-3">Multi-role system</div>
              <h2 className="font-serif text-3xl lg:text-4xl tracking-tight text-white leading-tight">
                Three roles.<br />One source of truth.<br />Consent at the centre.
              </h2>
              <p className="mt-5 text-slate-400 leading-relaxed text-sm">
                Recovery users own their data. Supporters see only what is explicitly shared.
                Clinicians get aggregated, anonymization-aware views — verified via invite code — for monitoring only.
              </p>
            </div>
            <div className="lg:col-span-8 grid sm:grid-cols-3 gap-4">
              {[
                { t: "Recovery User", Icon: Activity, d: "Daily check-ins, risk score, explanations, trend charts, privacy controls." },
                { t: "Supporter", Icon: Users, d: "Consent-gated view of shared signals, alert inbox, send encouragement messages." },
                { t: "Clinician", Icon: Eye, d: "Invite-code verified. Read-only patient panel, population risk distribution, flagged patterns." },
              ].map((r) => (
                <div key={r.t} className="glass rounded-xl p-5">
                  <r.Icon className="w-5 h-5 text-[#22D3EE]" />
                  <h4 className="mt-3 text-sm font-medium text-white">{r.t}</h4>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">{r.d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section className="border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-20 lg:py-24 grid lg:grid-cols-12 gap-12">
          <div className="lg:col-span-7">
            <div className="text-[11px] uppercase tracking-[0.22em] text-[#22D3EE] mb-3 flex items-center gap-2">
              <Lock className="w-3 h-3" /> Privacy &amp; ethics
            </div>
            <h2 className="font-serif text-3xl lg:text-4xl tracking-tight text-white leading-tight">
              Designed with future HIPAA-compliant architecture in mind.
            </h2>
            <ul className="mt-6 space-y-3 text-sm text-slate-300">
              {[
                "HttpOnly JWT cookies · bcrypt password hashing · backend-enforced RBAC.",
                "Clinician accounts require invite-code verification. Public signup cannot create one.",
                "Consent-driven sharing — every data class can be shared or withheld independently.",
                "Right-to-delete + CSV export — your personal health record is fully portable and removable.",
                "Anonymization-aware clinician view by default.",
                "Rule-based primary model is inspectable; no black box clinical decisions.",
              ].map((t) => (
                <li key={t} className="flex gap-3"><span className="text-[#22D3EE] mt-1.5">—</span><span>{t}</span></li>
              ))}
            </ul>
          </div>
          <div className="lg:col-span-5">
            <div className="glass rounded-xl p-7 gradient-border">
              <div className="text-[11px] uppercase tracking-[0.25em] text-[#22D3EE] mb-3">Position statement</div>
              <p className="font-serif text-2xl leading-snug text-white">
                "AI acts as a risk prediction assistant and pattern recognition tool — never a decision maker.
                A human always reviews. A human always acts."
              </p>
              <div className="mt-6 text-xs text-slate-500 font-mono">own-recovery / design principle</div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-wrap gap-3 items-center justify-between text-xs text-slate-500">
          <div>Own Recovery · Behavioral Health Decision Support · v0.2</div>
          <div>Simulation for research &amp; education. Not a medical device.</div>
        </div>
      </footer>
    </div>
  );
}
