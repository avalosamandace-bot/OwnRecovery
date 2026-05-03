import { Sparkles, TrendingUp, TrendingDown, Minus } from "lucide-react";

const toneClass = {
  warn:    "border-amber-500/30 bg-amber-500/5",
  good:    "border-emerald-500/30 bg-emerald-500/5",
  neutral: "border-white/5 bg-white/5",
};
const toneDot = {
  warn:    "bg-amber-400",
  good:    "bg-emerald-400",
  neutral: "bg-slate-400",
};

export default function AIObservations({ observations = [], forecast = null }) {
  return (
    <div className="glass rounded-xl p-6 relative overflow-hidden gradient-border" data-testid="ai-observations">
      <div className="absolute inset-x-0 top-0 h-px shimmer" />
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[#0F766E] to-[#22D3EE] flex items-center justify-center shadow-[0_0_16px_rgba(34,211,238,0.35)]">
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-[#22D3EE] font-medium">AI Observations</div>
          <div className="text-sm text-slate-300">Grounded in your last 14 days.</div>
        </div>
      </div>
      <div className="space-y-2.5">
        {observations.map((o, i) => (
          <div key={i} className={`rounded-lg border px-3.5 py-3 text-sm text-slate-200 flex items-start gap-3 ${toneClass[o.tone] || toneClass.neutral}`} data-testid={`obs-${i}`}>
            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full ${toneDot[o.tone] || toneDot.neutral}`} />
            <span className="leading-relaxed">{o.text}</span>
          </div>
        ))}
      </div>

      {forecast && (
        <div className="mt-4 rounded-lg border border-[#4F46E5]/30 bg-[#4F46E5]/5 p-3.5" data-testid="forecast">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-indigo-300">
            {forecast.direction === "up" ? <TrendingUp className="w-3.5 h-3.5" /> :
             forecast.direction === "down" ? <TrendingDown className="w-3.5 h-3.5" /> :
             <Minus className="w-3.5 h-3.5" />}
            <span>Weekly forecast</span>
          </div>
          <p className="text-sm text-slate-200 mt-1.5 leading-relaxed">{forecast.text}</p>
        </div>
      )}
    </div>
  );
}
