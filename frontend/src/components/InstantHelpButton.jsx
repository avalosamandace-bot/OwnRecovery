import { useState } from "react";
import { LifeBuoy, X, Phone, Wind, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";

export default function InstantHelpButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#0F766E] hover:bg-[#115e59] text-white text-sm font-medium shadow-[0_0_30px_rgba(15,118,110,0.55)] pulse-ring transition-colors"
        data-testid="instant-help-btn"
      >
        <LifeBuoy className="w-4 h-4" /> I need help now
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4" onClick={() => setOpen(false)}>
          <div className="glass-strong rounded-xl p-6 max-w-md w-full relative" onClick={(e) => e.stopPropagation()} data-testid="instant-help-modal">
            <button className="absolute top-3 right-3 text-slate-400 hover:text-white" onClick={() => setOpen(false)} aria-label="Close"><X className="w-4 h-4" /></button>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-[#22D3EE]"><LifeBuoy className="w-3.5 h-3.5" /> Right now</div>
            <h3 className="font-serif text-2xl text-white mt-2 leading-tight">You're not alone. Pick what feels possible.</h3>

            <div className="mt-5 space-y-2">
              <a href="tel:988" className="flex items-center gap-3 rounded-lg border border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10 p-3 transition-colors" data-testid="help-988">
                <Phone className="w-5 h-5 text-rose-300" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">Call 988 — Suicide & Crisis Lifeline</div>
                  <div className="text-xs text-slate-400">Free, confidential, 24/7. Tap to call.</div>
                </div>
              </a>
              <a href="tel:18006624357" className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 p-3 transition-colors" data-testid="help-samhsa">
                <Phone className="w-5 h-5 text-amber-300" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">SAMHSA Helpline · 1-800-662-HELP</div>
                  <div className="text-xs text-slate-400">Substance use and mental health support, 24/7.</div>
                </div>
              </a>
              <Link to="/app/craving" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 p-3 transition-colors" data-testid="help-craving">
                <Wind className="w-5 h-5 text-[#22D3EE]" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">Open the craving toolkit</div>
                  <div className="text-xs text-slate-400">Urge surfing, breathing, play-the-tape.</div>
                </div>
              </Link>
              <Link to="/app/resources" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 p-3 transition-colors" data-testid="help-resources">
                <BookOpen className="w-5 h-5 text-[#22D3EE]" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">Browse trusted resources</div>
                  <div className="text-xs text-slate-400">AA, NIDA, NIAAA, NAMI — verified links.</div>
                </div>
              </Link>
            </div>
            <p className="text-[11px] text-slate-500 mt-5 leading-relaxed border-t border-white/5 pt-3">
              This app is a support tool, not a medical diagnosis. If you are in immediate danger, call 911.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
