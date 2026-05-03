import { useEffect, useState } from "react";
import { api } from "../lib/api";
import Navbar from "../components/Navbar";
import TrendChart from "../components/TrendChart";
import AlertCard from "../components/AlertCard";
import { BadgeCheck, AlertTriangle } from "lucide-react";

const levelColor = {
  low: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
  medium: "text-amber-300 bg-amber-500/10 border-amber-500/30",
  high: "text-rose-300 bg-rose-500/10 border-rose-500/30",
};

export default function Clinician() {
  const [patients, setPatients] = useState([]);
  const [overview, setOverview] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get("/clinician/patients"),
      api.get("/clinician/overview"),
    ]).then(([p, o]) => {
      setPatients(p.data); setOverview(o.data);
      if (p.data.length) setSelected(p.data[0].id);
    }).catch((err) => {
      setError(err?.response?.data?.detail || "Access denied");
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    api.get(`/clinician/patients/${selected}`).then(r => setDetail(r.data));
  }, [selected]);

  if (error) {
    return (
      <div className="min-h-screen ambient-mesh">
        <Navbar />
        <div className="max-w-2xl mx-auto px-6 py-20">
          <div className="glass rounded-xl p-8 border border-rose-500/30">
            <AlertTriangle className="w-8 h-8 text-rose-400" />
            <h2 className="font-serif text-2xl text-white mt-3">Clinician verification required</h2>
            <p className="text-sm text-slate-400 mt-2">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen ambient-mesh">
      <Navbar />
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[#22D3EE]">
          <BadgeCheck className="w-3 h-3" /> Clinician panel · simulation
        </div>
        <h1 className="font-serif text-4xl lg:text-5xl tracking-tight text-white mt-1">Population monitoring</h1>
        <p className="text-sm text-slate-400 mt-2 max-w-2xl">Read-only, anonymization-aware view of risk distribution across enrolled recovery users. No direct intervention.</p>

        <div className="mt-3 text-[11px] text-amber-300/80 flex items-center gap-2">
          <AlertTriangle className="w-3 h-3" />
          Clinician verification in this demo is simulated. Real systems require credential verification.
        </div>

        {overview && (
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="overview">
            {[
              ["Total patients", overview.total_patients, "text-white"],
              ["Low risk", overview.risk_distribution.low, "text-emerald-300"],
              ["Medium risk", overview.risk_distribution.medium, "text-amber-300"],
              ["High risk", overview.risk_distribution.high, "text-rose-300"],
            ].map(([k, v, cls]) => (
              <div key={k} className="glass rounded-xl p-5">
                <div className="text-[10px] uppercase tracking-widest text-slate-500">{k}</div>
                <div className={`font-serif text-4xl mt-1 ${cls}`}>{v}</div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 grid lg:grid-cols-4 gap-6">
          <aside className="lg:col-span-1 space-y-2" data-testid="patient-list">
            <div className="text-xs uppercase tracking-widest text-slate-500 mb-2">Patients · sorted by risk</div>
            {patients.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                className={`w-full text-left rounded-lg border p-3 transition-colors ${selected === p.id ? "border-[#0F766E]/60 bg-[#0F766E]/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
                data-testid={`patient-${p.id}`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-mono text-sm text-white">{p.display_name}</span>
                  {p.latest_risk ? (
                    <span className={`text-[10px] px-2 py-0.5 rounded border ${levelColor[p.latest_risk.level]}`}>{p.latest_risk.score}</span>
                  ) : (
                    <span className="text-[10px] text-slate-500">no data</span>
                  )}
                </div>
                {p.open_alerts > 0 && <div className="text-[11px] text-rose-300 mt-1">{p.open_alerts} open alert(s)</div>}
              </button>
            ))}
          </aside>

          <div className="lg:col-span-3 space-y-6">
            {detail && (
              <>
                <div className="glass rounded-xl p-6">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <h2 className="font-mono text-xl text-white">{detail.display_name}</h2>
                      <div className="text-xs text-slate-500 mt-1">{detail.anonymized ? "Anonymized per patient consent" : "Name visible per patient consent"}</div>
                    </div>
                    <div className="text-xs text-slate-500">{detail.entries.length} entries · last 30d</div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <TrendChart data={detail.risks} dataKey="displayed_score" label="Risk score" color="#22D3EE" yDomain={[0,100]} />
                  <TrendChart data={detail.entries} dataKey="mood" label="Mood" color="#10B981" yDomain={[0,10]} />
                  <TrendChart data={detail.entries} dataKey="sleep_hours" label="Sleep (h)" color="#4F46E5" yDomain={[0,12]} />
                  <TrendChart data={detail.entries} dataKey="stress" label="Stress" color="#F59E0B" yDomain={[0,10]} />
                </div>

                <div>
                  <h3 className="text-sm font-medium text-white mb-3">Flagged patterns</h3>
                  <div className="space-y-3">
                    {detail.flagged_patterns.length === 0 && <div className="text-sm text-slate-500 italic">No patterns flagged in recent window.</div>}
                    {detail.flagged_patterns.map((f, i) => (
                      <AlertCard key={i} alert={{ ...f, id: `p-${i}`, acknowledged: false }} />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
