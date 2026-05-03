import { Heart, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "./ui/button";

export default function RelapseRecoveryBanner({ recentRelapse, why }) {
  if (!recentRelapse) return null;
  return (
    <div className="rounded-xl p-6 border border-[#22D3EE]/30 bg-gradient-to-br from-[#0F766E]/15 via-[#22D3EE]/5 to-[#4F46E5]/10 relative overflow-hidden fade-up" data-testid="relapse-banner">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-[#22D3EE]">
        <Heart className="w-3.5 h-3.5" /> Recovery mode
      </div>
      <h2 className="font-serif text-2xl lg:text-3xl text-white mt-2 leading-snug">
        You didn't fail. You're still in recovery.
      </h2>
      <p className="text-sm text-slate-300 mt-2 max-w-2xl leading-relaxed">
        A relapse is data, not a verdict. Today is the next day. Let's take one small step.
      </p>
      {why && (
        <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-3 max-w-2xl">
          <div className="text-[10px] uppercase tracking-widest text-slate-500">Your anchor</div>
          <p className="font-serif text-base text-white mt-1 italic">"{why}"</p>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to="/app/craving"><Button size="sm" className="bg-[#0F766E] hover:bg-[#115e59]" data-testid="rrm-craving"><Sparkles className="w-3.5 h-3.5 mr-1" /> Craving toolkit</Button></Link>
        <Link to="/app/resources"><Button size="sm" variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" data-testid="rrm-resources">Open resources</Button></Link>
        <Link to="/app/checkin"><Button size="sm" variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" data-testid="rrm-checkin">Restart with a check-in</Button></Link>
      </div>
    </div>
  );
}
