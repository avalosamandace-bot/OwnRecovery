import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export default function InsightCard({ title, value, delta, period }) {
  const positive = typeof delta === "number" && delta > 0;
  const negative = typeof delta === "number" && delta < 0;
  const deltaColor = positive ? "text-rose-300 bg-rose-500/10 border-rose-500/30" :
                     negative ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/30" :
                                "text-slate-400 bg-white/5 border-white/5";
  const Icon = positive ? ArrowUpRight : negative ? ArrowDownRight : null;

  return (
    <div className="glass rounded-xl p-5" data-testid={`insight-${title.replace(/ /g,'-').toLowerCase()}`}>
      <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">{title}</div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="font-serif text-3xl lg:text-4xl text-white leading-none">{value}</div>
        {typeof delta === "number" && (
          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-mono ${deltaColor}`}>
            {Icon && <Icon className="w-3 h-3" />}
            {delta > 0 ? "+" : ""}{delta}%
          </div>
        )}
      </div>
      {period && <div className="text-[11px] text-slate-500 mt-2">{period}</div>}
    </div>
  );
}
