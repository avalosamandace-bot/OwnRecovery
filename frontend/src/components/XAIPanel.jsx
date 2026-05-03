import { ArrowUp, ArrowDown, Minus } from "lucide-react";

export default function XAIPanel({ contributions = [], narrative = "", title = "Why this score" }) {
  const sorted = [...contributions].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  const maxAbs = Math.max(1, ...sorted.map((c) => Math.abs(c.contribution)));

  return (
    <div className="glass rounded-xl p-6 h-full" data-testid="xai-panel">
      <div className="flex items-baseline justify-between mb-1">
        <div className="text-[10px] font-medium uppercase tracking-[0.25em] text-[#22D3EE]">Explainable AI</div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500">Feature contributions</div>
      </div>
      <h3 className="text-lg font-medium text-white mb-3">{title}</h3>
      <p className="text-sm text-slate-400 leading-relaxed mb-5" data-testid="xai-narrative">{narrative}</p>

      <div className="space-y-3.5">
        {sorted.map((c) => {
          const w = (Math.abs(c.contribution) / maxAbs) * 100;
          const Icon = c.direction === "increase" ? ArrowUp : c.direction === "decrease" ? ArrowDown : Minus;
          const barColor =
            c.direction === "increase" ? "from-rose-500 to-rose-400" :
            c.direction === "decrease" ? "from-emerald-500 to-emerald-400" : "from-slate-500 to-slate-400";
          const txt =
            c.direction === "increase" ? "text-rose-300" :
            c.direction === "decrease" ? "text-emerald-300" : "text-slate-400";
          return (
            <div key={c.feature} data-testid={`xai-row-${c.feature}`}>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-2">
                  <Icon className={`w-3 h-3 ${txt}`} />
                  <span className="text-slate-200 font-medium">{c.label}</span>
                  <span className="text-slate-500 font-mono">· {c.value}</span>
                </div>
                <span className={`${txt} font-mono font-medium`}>
                  {c.contribution > 0 ? "+" : ""}{Number(c.contribution).toFixed(1)}
                </span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${barColor} rounded-full transition-all duration-700`}
                  style={{ width: `${w}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-500 mt-5 leading-relaxed border-t border-white/5 pt-3">
        Transparent rule-based model. Each factor contributes a weighted amount based on clinical heuristics. Decision-support — a human reviews, a human acts.
      </p>
    </div>
  );
}
