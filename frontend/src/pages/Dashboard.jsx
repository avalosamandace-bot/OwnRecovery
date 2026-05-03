import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import Navbar from "../components/Navbar";
import RiskGauge from "../components/RiskGauge";
import XAIPanel from "../components/XAIPanel";
import AlertCard from "../components/AlertCard";
import TrendChart from "../components/TrendChart";
import AIObservations from "../components/AIObservations";
import InsightCard from "../components/InsightCard";
import { Button } from "../components/ui/button";
import { Plus, ArrowRight, MessageCircle, Sparkles } from "lucide-react";

export default function Dashboard() {
  const [risk, setRisk] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [series, setSeries] = useState([]);
  const [messages, setMessages] = useState([]);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [r, a, s, m, ins] = await Promise.all([
        api.get("/health/risk/latest"),
        api.get("/health/alerts"),
        api.get("/health/risk/series?days=30"),
        api.get("/supporter/messages"),
        api.get("/insights/observations"),
      ]);
      setRisk(r.data);
      setAlerts(a.data);
      setSeries(s.data);
      setMessages(m.data);
      setInsights(ins.data);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const ack = async (id) => {
    await api.post(`/health/alerts/${id}/acknowledge`);
    setAlerts((prev) => prev.map(x => x.id === id ? { ...x, acknowledged: true } : x));
  };

  const openAlerts = alerts.filter(a => !a.acknowledged);

  return (
    <div className="min-h-screen ambient-mesh">
      <Navbar />
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-[#22D3EE] flex items-center gap-2">
              <Sparkles className="w-3 h-3" /> AI Command Center
            </div>
            <h1 className="font-serif text-4xl lg:text-5xl tracking-tight text-white mt-1">Your daily picture</h1>
            <p className="text-sm text-slate-400 mt-2 max-w-2xl">Risk, signals, and AI observations grounded strictly in your data. Decision support — not a diagnosis.</p>
          </div>
          <Link to="/app/checkin">
            <Button className="bg-[#0F766E] hover:bg-[#115e59] text-white shadow-[0_0_24px_rgba(15,118,110,0.35)]" data-testid="new-checkin-btn">
              <Plus className="w-4 h-4 mr-1" /> New check-in
            </Button>
          </Link>
        </div>

        {!loading && !risk && (
          <div className="mt-10 glass rounded-xl p-8 text-center" data-testid="no-data">
            <h3 className="font-serif text-2xl text-white">No check-ins yet.</h3>
            <p className="text-sm text-slate-400 mt-2">Log your first daily check-in to begin monitoring.</p>
            <Link to="/app/checkin"><Button className="mt-4 bg-[#0F766E] hover:bg-[#115e59]">Start first check-in <ArrowRight className="w-4 h-4 ml-1" /></Button></Link>
          </div>
        )}

        {risk && (
          <>
            {/* Row 1: gauge + XAI */}
            <div className="mt-8 grid lg:grid-cols-3 gap-6">
              <RiskGauge score={risk.displayed_score} level={risk.level} date={risk.entry_date} />
              <div className="lg:col-span-2">
                <XAIPanel contributions={risk.contributions} narrative={risk.narrative} />
              </div>
            </div>

            {/* Row 2: Insight cards */}
            {insights?.insight_cards?.length > 0 && (
              <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="insight-cards">
                {insights.insight_cards.map((c) => (
                  <InsightCard key={c.title} title={c.title} value={c.value} delta={c.delta} period={c.period} />
                ))}
              </div>
            )}

            {/* Row 3: Risk chart + AI observations */}
            <div className="mt-6 grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                {series.length > 0 && (
                  <TrendChart
                    data={series}
                    dataKey="displayed_score"
                    ma7Key="ma7"
                    label="30-day relapse risk"
                    color="#22D3EE"
                    yDomain={[0, 100]}
                  />
                )}
              </div>
              <div>
                {insights && <AIObservations observations={insights.observations} forecast={insights.forecast} />}
              </div>
            </div>

            {/* Row 4: Alerts + messages */}
            <div className="mt-8 grid lg:grid-cols-2 gap-6">
              <div>
                <div className="flex items-baseline justify-between mb-3">
                  <h3 className="text-lg font-medium text-white">Clinical alerts</h3>
                  <span className="text-xs text-slate-500" data-testid="alert-count">{openAlerts.length} open</span>
                </div>
                <div className="space-y-3">
                  {alerts.length === 0 && <div className="text-sm text-slate-500 italic">No alerts yet.</div>}
                  {alerts.slice(0, 6).map((a) => <AlertCard key={a.id} alert={a} onAck={ack} />)}
                </div>
              </div>

              <div>
                <div className="flex items-baseline justify-between mb-3">
                  <h3 className="text-lg font-medium text-white">Messages from supporters</h3>
                  <MessageCircle className="w-4 h-4 text-slate-500" />
                </div>
                <div className="space-y-3">
                  {messages.length === 0 && (
                    <div className="text-sm text-slate-500 italic">No messages yet. Share a connection from Privacy settings.</div>
                  )}
                  {messages.slice(0, 8).map((m) => (
                    <div key={m.id} className="glass rounded-lg p-4" data-testid={`msg-${m.id}`}>
                      <div className="text-xs text-slate-500 flex justify-between">
                        <span>From {m.from_supporter_name}</span>
                        <span className="font-mono">{new Date(m.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="text-sm text-slate-200 mt-1 leading-relaxed">{m.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
