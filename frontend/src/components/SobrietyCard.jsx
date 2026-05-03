import { Flame, Trophy, Target } from "lucide-react";
import { Link } from "react-router-dom";

const milestoneLabel = (n) => `${n}-day`;

export default function SobrietyCard({ status }) {
  if (!status) return null;
  if (!status.sobriety_start_date) {
    return (
      <Link to="/app/sobriety" className="glass rounded-xl p-6 block hover:bg-white/[0.07] transition-colors gradient-border" data-testid="sobriety-empty">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-[#22D3EE]">
          <Flame className="w-3.5 h-3.5" /> Sobriety
        </div>
        <h3 className="font-serif text-2xl text-white mt-2">Set your start date</h3>
        <p className="text-sm text-slate-400 mt-2 leading-relaxed">A simple anchor. Track the days. See the milestones. Log honestly if you slip.</p>
        <div className="mt-3 text-xs text-[#22D3EE]">Set start date →</div>
      </Link>
    );
  }
  const { current_streak_days: c, longest_streak_days: longest, next_milestone: next, days_to_next_milestone: toNext, milestones_reached: reached } = status;
  const pct = next ? Math.max(0, Math.min(100, ((c) / next) * 100)) : 100;
  return (
    <div className="glass rounded-xl p-6 relative overflow-hidden" data-testid="sobriety-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-[#22D3EE]">
          <Flame className="w-3.5 h-3.5" /> Days sober
        </div>
        <Link to="/app/sobriety" className="text-[11px] text-slate-500 hover:text-white">Manage →</Link>
      </div>
      <div className="mt-2 flex items-baseline gap-3">
        <div className="font-serif text-6xl text-white leading-none">{c}</div>
        <div className="text-sm text-slate-400">{c === 1 ? "day" : "days"}</div>
      </div>
      <div className="mt-1 text-xs text-slate-500">Longest streak: <span className="text-slate-300 font-mono">{longest}</span></div>

      {next && (
        <div className="mt-5">
          <div className="flex items-center justify-between text-[11px] mb-1.5">
            <span className="text-slate-400 inline-flex items-center gap-1"><Target className="w-3 h-3" /> Next milestone: {milestoneLabel(next)}</span>
            <span className="font-mono text-slate-300">{toNext} to go</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#0F766E] to-[#22D3EE] rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {reached?.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-1.5">
          {reached.map((m) => (
            <span key={m} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#0F766E]/15 border border-[#0F766E]/30 text-[#5EEAD4]" data-testid={`milestone-${m}`}>
              <Trophy className="w-3 h-3" /> {m}d
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
