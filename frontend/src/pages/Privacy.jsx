import { useEffect, useState } from "react";
import { api, API } from "../lib/api";
import Navbar from "../components/Navbar";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Switch } from "../components/ui/switch";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { AlertTriangle, Download } from "lucide-react";

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

export default function Privacy() {
  const [consent, setConsent] = useState(null);
  const [invites, setInvites] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [danger, setDanger] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = async () => {
    const [c, i] = await Promise.all([
      api.get("/consent"),
      api.get("/supporter/my-invites"),
    ]);
    setConsent(c.data);
    setInvites(i.data);
  };
  useEffect(() => { load(); }, []);

  const toggle = async (field, value) => {
    const { data } = await api.patch("/consent", { [field]: value });
    setConsent(data);
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

  return (
    <div className="min-h-screen ambient-mesh">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="text-[11px] uppercase tracking-[0.22em] text-[#22D3EE]">Privacy &amp; consent</div>
        <h1 className="font-serif text-4xl lg:text-5xl tracking-tight text-white mt-1">You own your record.</h1>
        <p className="text-sm text-slate-400 mt-2 max-w-2xl">Granular, per-field sharing controls. Consent is enforced at the API layer — not merely the UI.</p>

        <section className="mt-8 glass rounded-xl divide-y divide-white/5 overflow-hidden">
          {CONSENT_FIELDS.map(([key, title, desc]) => (
            <div key={key} className="p-4 flex items-start justify-between gap-6" data-testid={`consent-${key}`}>
              <div>
                <Label className="text-sm font-medium text-white">{title}</Label>
                <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
              </div>
              <Switch checked={!!consent[key]} onCheckedChange={(v) => toggle(key, v)} />
            </div>
          ))}
        </section>

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
