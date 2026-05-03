const levelConfig = {
  low:    { color: "#10B981", glow: "rgba(16,185,129,0.35)",  label: "Low risk",    chipBg: "bg-emerald-500/10",  chipBorder: "border-emerald-500/30",  chipText: "text-emerald-300" },
  medium: { color: "#F59E0B", glow: "rgba(245,158,11,0.35)",  label: "Medium risk", chipBg: "bg-amber-500/10",    chipBorder: "border-amber-500/30",    chipText: "text-amber-300" },
  high:   { color: "#EF4444", glow: "rgba(239,68,68,0.35)",   label: "High risk",   chipBg: "bg-rose-500/10",     chipBorder: "border-rose-500/30",     chipText: "text-rose-300" },
};

export default function RiskGauge({ score = 0, level = "low", date }) {
  const cfg = levelConfig[level] || levelConfig.low;
  const pct = Math.max(0, Math.min(100, score));
  const radius = 82;
  const circumference = Math.PI * radius;
  const dash = `${(pct / 100) * circumference} ${circumference}`;

  return (
    <div className="glass rounded-xl p-6 flex flex-col items-center relative overflow-hidden" data-testid="risk-gauge">
      <div
        className="absolute -inset-20 pointer-events-none opacity-30 blur-3xl"
        style={{ background: `radial-gradient(circle at center, ${cfg.glow}, transparent 60%)` }}
      />
      <div className="text-[10px] font-medium uppercase tracking-[0.25em] text-slate-500 mb-2 relative">Relapse Risk Score</div>
      <svg width="240" height="140" viewBox="0 0 240 140" className="relative">
        <defs>
          <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={cfg.color} stopOpacity="0.6" />
            <stop offset="100%" stopColor={cfg.color} />
          </linearGradient>
        </defs>
        <path d="M 30 115 A 90 90 0 0 1 210 115" fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="12" strokeLinecap="round" />
        <path
          d="M 30 115 A 90 90 0 0 1 210 115"
          fill="none"
          stroke="url(#arcGrad)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={dash}
          style={{ transition: "stroke-dasharray 0.9s cubic-bezier(0.22,1,0.36,1)", filter: `drop-shadow(0 0 8px ${cfg.glow})` }}
        />
        <text x="120" y="95" textAnchor="middle" fontSize="48" fontWeight="300" fill="#F1F5F9" fontFamily="Inter">
          {Math.round(pct)}
        </text>
        <text x="120" y="118" textAnchor="middle" fontSize="11" fill="#64748B" fontFamily="Inter" letterSpacing="2">
          OF 100
        </text>
      </svg>
      <div className={`relative mt-2 px-3 py-1 rounded-full text-xs font-medium border ${cfg.chipBg} ${cfg.chipBorder} ${cfg.chipText}`} data-testid="risk-level">
        {cfg.label}
      </div>
      {date && <div className="text-[11px] text-slate-500 mt-2 font-mono relative">{date}</div>}
    </div>
  );
}
