import { Sparkles, Plus, Minus } from "lucide-react";

export default function RecoveryScoreCard({ data }) {
  if (!data) return null;
  const { score, level, helpers = [], improvers = [] } = data;
  const cfg = level === "strong"
    ? { color: "#10B981", label: "Strong" }
    : level === "steady"
    ? { color: "#22D3EE", label: "Steady" }
    : { color: "#94A3B8", label: "Early" };
  const pct = Math.max(0, Math.min(100, score));

  return (
    <div className="glass rounded-xl p-6" data-testid="recovery-score">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-[#22D3EE]">
          <Sparkles className="w-3.5 h-3.5" /> Recovery score
        </div>
        <span className="text-[10px] uppercase tracking-widest text-slate-500">protective factors</span>
      </div>
      <div className="mt-2 flex items-baseline gap-3">
        <div className="font-serif text-6xl text-white leading-none">{Math.round(pct)}</div>
        <div className="text-sm text-slate-400">/ 100</div>
        <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] border" style={{ color: cfg.color, borderColor: cfg.color + "55", background: cfg.color + "10" }}>{cfg.label}</span>
      </div>
      <div className="mt-3 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: `linear-gradient(90deg, #0F766E, ${cfg.color})` }} />
      </div>

      {helpers.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {helpers.slice(0, 3).map((h, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
              <Plus className="w-3 h-3 mt-0.5 text-emerald-400" />
              <span>{h}</span>
            </div>
          ))}
        </div>
      )}
      {improvers.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-white/5 pt-3">
          {improvers.slice(0, 2).map((h, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-slate-400">
              <Minus className="w-3 h-3 mt-0.5 text-amber-400" />
              <span>{h}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
