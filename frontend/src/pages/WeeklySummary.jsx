import { useEffect, useState } from "react";
import { api } from "../lib/api";
import Navbar from "../components/Navbar";
import { Button } from "../components/ui/button";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function WeeklySummary() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get("/summary/weekly/latest");
      setSummary(data);
    } catch { /* ignore */ }
  };

  const generate = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/summary/weekly");
      setSummary(data);
      toast.success(data.source === "llm" ? "AI summary generated." : "Template summary generated.");
    } catch {
      toast.error("Could not generate summary");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen ambient-mesh">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="text-[11px] uppercase tracking-[0.22em] text-[#22D3EE]">Weekly summary</div>
        <h1 className="font-serif text-4xl lg:text-5xl tracking-tight text-white mt-1">This week, in context.</h1>
        <p className="text-sm text-slate-400 mt-2 max-w-2xl">A calm, grounded summary produced strictly from your structured data — no hallucination, no diagnosis.</p>

        <div className="mt-6">
          <Button onClick={generate} disabled={loading} className="bg-[#0F766E] hover:bg-[#115e59] shadow-[0_0_24px_rgba(15,118,110,0.35)]" data-testid="generate-summary">
            <Sparkles className="w-4 h-4 mr-1" />
            {loading ? "Generating…" : summary ? "Regenerate summary" : "Generate summary"}
          </Button>
        </div>

        {summary && (
          <article className="mt-8 glass rounded-xl p-8 lg:p-10 gradient-border" data-testid="summary-card">
            <div className="flex items-baseline justify-between text-xs text-slate-500 mb-4">
              <div className="font-mono">{summary.week_start} — {summary.week_end}</div>
              <div className="uppercase tracking-widest">Source: {summary.source === "llm" ? "GPT-5.2" : "template"}</div>
            </div>
            <p className="font-serif text-xl lg:text-2xl text-white leading-relaxed" data-testid="summary-text">
              {summary.summary_text}
            </p>
            {summary.stats && Object.keys(summary.stats).length > 0 && (
              <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  ["Days logged", summary.stats.days_logged],
                  ["Avg mood", summary.stats.avg_mood],
                  ["Avg sleep", summary.stats.avg_sleep],
                  ["Avg stress", summary.stats.avg_stress],
                  ["Avg craving", summary.stats.avg_craving],
                  ["Triggers", summary.stats.total_triggers],
                  ["Avg risk", summary.stats.avg_risk_score],
                ].filter(([, v]) => v !== undefined).map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-white/5 border border-white/5 p-4">
                    <div className="text-[10px] uppercase tracking-widest text-slate-500">{k}</div>
                    <div className="font-serif text-2xl text-white mt-1">{v}</div>
                  </div>
                ))}
              </div>
            )}
          </article>
        )}

        {!summary && !loading && (
          <div className="mt-8 text-sm text-slate-500 italic">No summary yet. Click "Generate summary" after logging a few check-ins.</div>
        )}
      </div>
    </div>
  );
}
