import { useEffect, useState } from "react";
import { api } from "../lib/api";
import Navbar from "../components/Navbar";
import AlertCard from "../components/AlertCard";
import TrendChart from "../components/TrendChart";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { toast } from "sonner";

export default function Supporter() {
  const [conns, setConns] = useState([]);
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState(null);
  const [msg, setMsg] = useState("");

  const loadConns = async () => {
    const { data } = await api.get("/supporter/connections");
    setConns(data);
    if (data.length && !selected) setSelected(data[0].recovery_user.id);
  };
  useEffect(() => { loadConns(); }, []);

  useEffect(() => {
    if (!selected) return;
    api.get(`/supporter/view/${selected}`).then(r => setView(r.data)).catch(() => setView(null));
  }, [selected]);

  const send = async () => {
    if (!msg.trim() || !selected) return;
    try {
      await api.post("/supporter/encourage", { user_id: selected, message: msg });
      toast.success("Message sent");
      setMsg("");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not send");
    }
  };

  return (
    <div className="min-h-screen ambient-mesh">
      <Navbar />
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="text-[11px] uppercase tracking-[0.22em] text-[#22D3EE]">Supporter dashboard</div>
        <h1 className="font-serif text-4xl lg:text-5xl tracking-tight text-white mt-1">People you support</h1>
        <p className="text-sm text-slate-400 mt-2 max-w-2xl">You see only what has been explicitly shared with you. Your role is presence, not intervention.</p>

        {conns.length === 0 && (
          <div className="mt-8 glass rounded-xl p-6 text-sm text-slate-400">
            No connections yet. When a recovery user invites you by email, their shared signals will appear here.
          </div>
        )}

        <div className="mt-8 grid lg:grid-cols-4 gap-6">
          <aside className="lg:col-span-1 space-y-2" data-testid="conn-list">
            {conns.map((c) => (
              <button
                key={c.recovery_user.id}
                onClick={() => setSelected(c.recovery_user.id)}
                className={`w-full text-left rounded-lg border p-3 transition-colors ${selected === c.recovery_user.id ? "border-[#0F766E]/60 bg-[#0F766E]/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
                data-testid={`conn-${c.recovery_user.id}`}
              >
                <div className="text-sm font-medium text-white">{c.recovery_user.name}</div>
                <div className="text-xs text-slate-500">{c.recovery_user.email}</div>
              </button>
            ))}
          </aside>

          <div className="lg:col-span-3 space-y-6">
            {view && (
              <>
                <div className="glass rounded-xl p-6">
                  <div className="flex items-baseline justify-between">
                    <h2 className="text-xl font-medium text-white">{view.recovery_user.name}</h2>
                    {view.latest_risk && (
                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-widest text-slate-500">Latest risk</div>
                        <div className="font-serif text-4xl text-white">{view.latest_risk.displayed_score}</div>
                        <div className="text-xs text-slate-500">{view.latest_risk.level} · {view.latest_risk.entry_date}</div>
                      </div>
                    )}
                  </div>
                  {view.latest_risk?.narrative && (
                    <p className="text-sm text-slate-300 mt-3 italic border-l-2 border-[#22D3EE]/40 pl-3">{view.latest_risk.narrative}</p>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {view.entries.some(e => e.mood !== undefined) && (
                    <TrendChart data={view.entries} dataKey="mood" label="Mood (shared)" color="#10B981" yDomain={[0,10]} />
                  )}
                  {view.entries.some(e => e.sleep_hours !== undefined) && (
                    <TrendChart data={view.entries} dataKey="sleep_hours" label="Sleep (shared)" color="#4F46E5" yDomain={[0,12]} />
                  )}
                  {view.entries.some(e => e.stress !== undefined) && (
                    <TrendChart data={view.entries} dataKey="stress" label="Stress (shared)" color="#F59E0B" yDomain={[0,10]} />
                  )}
                  {view.entries.some(e => e.craving !== undefined) && (
                    <TrendChart data={view.entries} dataKey="craving" label="Craving (shared)" color="#EF4444" yDomain={[0,10]} />
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-medium text-white mb-3">Shared alerts</h3>
                  <div className="space-y-3">
                    {view.alerts.length === 0 && <div className="text-sm text-slate-500 italic">No alerts shared.</div>}
                    {view.alerts.map((a) => <AlertCard key={a.id} alert={a} />)}
                  </div>
                </div>

                <div className="glass rounded-xl p-5">
                  <h3 className="text-sm font-medium text-white">Send encouragement</h3>
                  <p className="text-xs text-slate-400 mt-1">A short note grounded in care. They'll see it on their dashboard.</p>
                  <Textarea rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} className="mt-3 bg-white/5 border-white/10 text-white" placeholder="Thinking of you today…" data-testid="encourage-text" />
                  <div className="mt-3 flex justify-end">
                    <Button onClick={send} disabled={!msg.trim()} className="bg-[#0F766E] hover:bg-[#115e59]" data-testid="encourage-send">Send</Button>
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
