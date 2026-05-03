import { useEffect, useState } from "react";
import { api } from "../lib/api";
import Navbar from "../components/Navbar";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Switch } from "../components/ui/switch";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import {
  AlertTriangle, Download, ShieldCheck, Eye, Brain, UserCheck, FileSearch, Database,
} from "lucide-react";

const CONSENT_FIELDS = [
  ["share_mood", "Share mood", "Share daily mood reading with connected supporters."],
  ["share_craving", "Share craving intensity", "Sensitive — off by default."],
  ["share_sleep", "Share sleep hours", "Useful context for supporters."],
  ["share_stress", "Share stress level", "Useful context for supporters."],
  ["share_triggers", "Share trigger events", "Sensitive — off by default."],
  ["share_notes", "Share personal notes", "Off by default."],
  ["share_risk_score", "Share daily risk score", "Supporters see the 0-100 score."],
  ["share_alerts", "Share alerts", "Medium/high clinical alerts are forwarded."],
  ["anonymize_clinician_view", "Anonymize me in clinician view", "Replace name with opaque patient code."],
];

const PRINCIPLE_ICONS = {
  consent_first: ShieldCheck,
  explainable: Brain,
  anonymizable: Eye,
  human_in_loop: UserCheck,
  right_to_export_delete: Database,
};

const ACTION_LABEL = {
  clinician_view_patient: "Clinician viewed your record",
  clinician_list_patients: "Clinician listed patients (you appeared)",
  export_patient_pdf: "Clinician exported a clinical PDF",
  list_users: "Admin listed all users",
  update_user_flags: "Admin updated account flags",
};

export default function Privacy() {
  const [consent, setConsent] = useState(null);
  const [transparency, setTransparency] = useState(null);
  const [accessLog, setAccessLog] = useState([]);
  const [invites, setInvites] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [danger, setDanger] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = async () => {
    const [c, i, t, a] = await Promise.all([
      api.get("/consent"),
      api.get("/supporter/my-invites"),
      api.get("/consent/transparency"),
      api.get("/consent/access-log"),
    ]);
    setConsent(c.data);
    setInvites(i.data);
    setTransparency(t.data);
    setAccessLog(a.data.events);
  };
  useEffect(() => { load(); }, []);

  const toggle = async (field, value) => {
    const { data } = await api.patch("/consent", { [field]: value });
    setConsent(data);
    // refresh transparency snapshot too
    api.get("/consent/transparency").then((r) => setTransparency(r.data)).catch(() => {});
    toast.success("Preference updated");
  };

  const invite = async () => {
    if (!inviteEmail) return;
    try {
      await api.post("/supporter/invite", { supporter_email: inviteEmail });
      toast.success("Supporter invited");
      setInviteEmail("");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not invite");
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const r = await api.get("/health/export/csv", { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([r.data], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url; a.download = `own-recovery-export.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast.success("Export ready");
    } catch {
      toast.error("Export failed");
    } finally { setExporting(false); }
  };

  const deleteAll = async () => {
    try {
      await api.delete("/health/data");
      toast.success("All health records deleted");
      setDanger(false);
    } catch {
      toast.error("Delete failed");
    }
  };

  if (!consent) return <div className="min-h-screen ambient-mesh"><Navbar /><div className="p-10 text-slate-400">Loading…</div></div>;

  const onShareCount = Object.entries(consent).filter(([k, v]) => k.startsWith("share_") && v === true).length;

  return (
    <div className="min-h-screen ambient-mesh" data-testid="trust-dashboard">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="text-[11px] uppercase tracking-[0.22em] text-[#22D3EE]">Trust &amp; privacy</div>
        <h1 className="font-serif text-4xl lg:text-5xl tracking-tight text-white mt-1">You own your record.</h1>
        <p className="text-sm text-slate-400 mt-2 max-w-2xl">A live view of what we collect, who can see it, and a log of every time someone touched your record. Toggle below — consent is enforced at the API, not the UI.</p>

        {/* Trust banner */}
        <section className="mt-8 grid md:grid-cols-3 gap-3">
          <div className="glass rounded-xl p-5">
            <div className="text-[10px] uppercase tracking-widest text-slate-500">Sharing posture</div>
            <div className="font-serif text-3xl text-white mt-1">{onShareCount}<span className="text-slate-500 text-base">/8</span></div>
            <div className="text-[11px] text-slate-400 mt-1">signals you currently share</div>
          </div>
          <div className="glass rounded-xl p-5">
            <div className="text-[10px] uppercase tracking-widest text-slate-500">Anonymized to clinicians</div>
            <div className={`font-serif text-3xl mt-1 ${consent.anonymize_clinician_view ? "text-emerald-300" : "text-amber-300"}`}>
              {consent.anonymize_clinician_view ? "ON" : "OFF"}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">P-code shown instead of your name</div>
          </div>
          <div className="glass rounded-xl p-5">
            <div className="text-[10px] uppercase tracking-widest text-slate-500">Data points on file</div>
            <div className="font-serif text-3xl text-cyan-300 mt-1">
              {transparency ? Object.values(transparency.data_on_file).reduce((a, b) => a + b, 0) : "—"}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">across check-ins, scores &amp; alerts</div>
          </div>
        </section>

        {/* Principles */}
        {transparency && (
          <section className="mt-8 grid md:grid-cols-2 gap-3" data-testid="trust-principles">
            {transparency.principles.map((p) => {
              const Icon = PRINCIPLE_ICONS[p.k] || ShieldCheck;
              return (
                <div key={p.k} className="glass rounded-xl p-5 flex gap-3">
                  <div className="shrink-0 w-9 h-9 rounded-lg bg-[#0F766E]/15 border border-[#22D3EE]/25 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-[#22D3EE]" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">{p.title}</div>
                    <div className="text-xs text-slate-400 mt-1 leading-relaxed">{p.body}</div>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* What we collect */}
        {transparency && (
          <section className="mt-8 glass rounded-xl p-5" data-testid="data-on-file">
            <h2 className="text-lg font-medium text-white">What we have on file</h2>
            <p className="text-xs text-slate-400 mt-1">Live counts. These are what supporters or clinicians could ever see — bounded by the toggles below.</p>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(transparency.data_on_file).map(([k, v]) => (
                <div key={k} className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 flex items-center justify-between">
                  <span className="text-xs text-slate-300 font-mono">{k.replace(/_/g, " ")}</span>
                  <span className="font-serif text-xl text-white">{v}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Consent toggles */}
        <section className="mt-10">
          <h2 className="text-lg font-medium text-white">Sharing controls</h2>
          <p className="text-xs text-slate-400 mt-1">Granular per-field. Off by default for sensitive signals.</p>
          <div className="mt-4 glass rounded-xl divide-y divide-white/5 overflow-hidden">
            {CONSENT_FIELDS.map(([key, title, desc]) => (
              <div key={key} className="p-4 flex items-start justify-between gap-6" data-testid={`consent-${key}`}>
                <div>
                  <Label className="text-sm font-medium text-white">{title}</Label>
                  <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                </div>
                <Switch checked={!!consent[key]} onCheckedChange={(v) => toggle(key, v)} />
              </div>
            ))}
          </div>
        </section>

        {/* Access log */}
        <section className="mt-10" data-testid="access-log">
          <div className="flex items-center gap-2">
            <FileSearch className="w-4 h-4 text-[#22D3EE]" />
            <h2 className="text-lg font-medium text-white">Who accessed my record</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">Read-only audit of clinician and admin reads on your data.</p>
          <div className="mt-3 glass rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-[10px] uppercase tracking-widest text-slate-400">
                <tr>
                  <th className="text-left p-3">When</th>
                  <th className="text-left p-3">Who</th>
                  <th className="text-left p-3">Action</th>
                  <th className="text-left p-3">Anonymized?</th>
                </tr>
              </thead>
              <tbody>
                {accessLog.length === 0 && (
                  <tr><td colSpan={4} className="p-6 text-center text-slate-500 italic">No access events yet.</td></tr>
                )}
                {accessLog.map((e, idx) => (
                  <tr key={idx} className="border-t border-white/5">
                    <td className="p-3 text-xs text-slate-400 whitespace-nowrap">{e.created_at?.slice(0, 19).replace("T", " ")}</td>
                    <td className="p-3 text-xs">
                      <div className="text-slate-200 font-mono">{e.actor_email}</div>
                      <div className="text-slate-500 text-[10px]">{e.actor_role}{e.actor_is_admin && " · admin"}</div>
                    </td>
                    <td className="p-3 text-xs text-cyan-200">{ACTION_LABEL[e.action] || e.action}</td>
                    <td className="p-3 text-xs">
                      {e.anonymized === true && <span className="text-emerald-300">yes</span>}
                      {e.anonymized === false && <span className="text-amber-300">no</span>}
                      {e.anonymized == null && <span className="text-slate-500">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Connected supporters */}
        <section className="mt-10">
          <h2 className="text-lg font-medium text-white">Connected supporters</h2>
          <p className="text-xs text-slate-400 mt-1">Invite a trusted person by email. They must sign up as a Supporter.</p>
          <div className="mt-4 flex gap-2">
            <Input type="email" placeholder="supporter@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="max-w-sm bg-white/5 border-white/10 text-white" data-testid="invite-email" />
            <Button onClick={invite} className="bg-[#0F766E] hover:bg-[#115e59]" data-testid="invite-btn">Invite</Button>
          </div>
          <div className="mt-4 space-y-2">
            {invites.length === 0 && <div className="text-sm text-slate-500 italic">No supporters connected.</div>}
            {invites.map((i) => (
              <div key={i.id} className="flex justify-between items-center glass rounded-lg px-4 py-2 text-sm" data-testid={`invite-${i.id}`}>
                <span className="text-slate-200">{i.supporter_email}</span>
                <span className="text-xs uppercase tracking-widest text-slate-500">{i.status}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12 glass rounded-xl p-5">
          <div className="flex items-start gap-3">
            <Download className="w-5 h-5 text-[#22D3EE] mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-white">Export my data</h3>
              <p className="text-xs text-slate-400 mt-1">Download all your check-ins and risk scores as CSV — for analysis, backup, or to take to a clinician.</p>
              <Button onClick={exportCsv} disabled={exporting} variant="outline" className="mt-3 border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white" data-testid="export-csv">
                <Download className="w-4 h-4 mr-1" />
                {exporting ? "Preparing…" : "Download CSV"}
              </Button>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-rose-500/30 bg-rose-500/5 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-rose-200">Delete my health record</h3>
              <p className="text-xs text-rose-300/80 mt-1">Permanently removes all your check-ins, risk scores, alerts, and weekly summaries. This cannot be undone.</p>
              {!danger ? (
                <Button variant="outline" className="mt-3 border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 hover:text-white" onClick={() => setDanger(true)} data-testid="delete-btn">I want to delete my data</Button>
              ) : (
                <div className="mt-3 flex gap-2">
                  <Button variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => setDanger(false)}>Cancel</Button>
                  <Button onClick={deleteAll} className="bg-rose-600 hover:bg-rose-700 text-white" data-testid="delete-confirm">Confirm delete</Button>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
