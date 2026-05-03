import { Anchor, Pencil } from "lucide-react";
import { Link } from "react-router-dom";

export default function WhyImSoberCard({ why, tags = [] }) {
  if (!why) {
    return (
      <Link to="/app/sobriety" className="glass rounded-xl p-6 block hover:bg-white/[0.07] transition-colors" data-testid="why-empty">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-[#22D3EE]">
          <Anchor className="w-3.5 h-3.5" /> Why I'm sober
        </div>
        <h3 className="font-serif text-xl text-white mt-2">Write your anchor.</h3>
        <p className="text-sm text-slate-400 mt-2 leading-relaxed">One sentence. Your reason. We'll bring it back when it matters most — high-risk days, cravings, after a slip.</p>
        <div className="mt-3 text-xs text-[#22D3EE]">Write it now →</div>
      </Link>
    );
  }
  return (
    <div className="glass rounded-xl p-6 relative overflow-hidden gradient-border" data-testid="why-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-[#22D3EE]">
          <Anchor className="w-3.5 h-3.5" /> Why I'm sober
        </div>
        <Link to="/app/sobriety" className="text-[11px] text-slate-500 hover:text-white inline-flex items-center gap-1"><Pencil className="w-3 h-3" /> Edit</Link>
      </div>
      <p className="font-serif text-xl text-white mt-3 leading-snug" data-testid="why-text">"{why}"</p>
      {tags?.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-300">{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}
