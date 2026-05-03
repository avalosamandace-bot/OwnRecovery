import { useEffect, useState } from "react";
import { api } from "../lib/api";
import Navbar from "../components/Navbar";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Checkbox } from "../components/ui/checkbox";
import { CheckCircle2, Compass } from "lucide-react";
import { toast } from "sonner";

export default function TwelveSteps() {
  const [data, setData] = useState(null);
  const [drafts, setDrafts] = useState({}); // {n: text}

  const load = async () => {
    const r = await api.get("/steps");
    setData(r.data);
  };
  useEffect(() => { load(); }, []);

  const save = async (n, marked) => {
    const reflection = drafts[n] !== undefined ? drafts[n] : (data.steps.find(s => s.n === n)?.reflection || "");
    try {
      await api.post(`/steps/${n}/reflect`, { reflection, marked_reflected: marked });
      toast.success(marked ? "Reflection saved." : "Reflection updated.");
      load();
    } catch { toast.error("Could not save"); }
  };

  if (!data) return <div className="min-h-screen ambient-mesh"><Navbar /><div className="p-10 text-slate-400">Loading…</div></div>;

  return (
    <div className="min-h-screen ambient-mesh">
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="text-[11px] uppercase tracking-[0.22em] text-[#22D3EE] flex items-center gap-2"><Compass className="w-3 h-3" /> Twelve steps · modern</div>
        <h1 className="font-serif text-4xl lg:text-5xl text-white mt-1 leading-tight">Twelve steps, in your words.</h1>
        <p className="text-sm text-slate-400 mt-2 max-w-2xl">A secular, inclusive rewrite focused on accountability, honesty, self-awareness, support, and growth. Take one at a time.</p>

        <div className="mt-4 flex items-center gap-3 text-xs text-slate-400" data-testid="steps-progress">
          <div className="h-1.5 w-48 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#0F766E] to-[#22D3EE] rounded-full transition-all" style={{ width: `${(data.completed / data.total) * 100}%` }} />
          </div>
          <span className="font-mono">{data.completed} / {data.total} reflected</span>
        </div>

        <div className="mt-8 space-y-4">
          {data.steps.map((s) => (
            <div key={s.n} className="glass rounded-xl p-5" data-testid={`step-${s.n}`}>
              <div className="flex items-baseline justify-between">
                <div className="text-[10px] uppercase tracking-widest text-[#22D3EE] font-mono">Step {s.n}</div>
                {s.marked_reflected && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300"><CheckCircle2 className="w-3 h-3" /> Reflected</span>
                )}
              </div>
              <h3 className="font-serif text-xl text-white mt-1 leading-snug">{s.title}</h3>
              <p className="text-sm text-slate-400 mt-2 leading-relaxed italic">{s.prompt}</p>

              <Textarea
                rows={3}
                defaultValue={s.reflection}
                onChange={(e) => setDrafts((d) => ({ ...d, [s.n]: e.target.value }))}
                placeholder="Write a few honest sentences. No one else sees this."
                className="mt-3 bg-white/5 border-white/10 text-white"
                data-testid={`step-reflect-${s.n}`}
              />
              <div className="mt-3 flex items-center gap-3">
                <Button size="sm" onClick={() => save(s.n, true)} className="bg-[#0F766E] hover:bg-[#115e59]" data-testid={`mark-${s.n}`}>
                  {s.marked_reflected ? "Update reflection" : "Save & mark reflected"}
                </Button>
                {s.marked_reflected && (
                  <Button size="sm" variant="ghost" onClick={() => save(s.n, false)} className="text-slate-400 hover:text-white hover:bg-white/5">
                    Unmark
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-slate-500 mt-10 leading-relaxed border-t border-white/5 pt-4">
          Inspired by, not a replacement for, the original twelve steps. Visit <a className="underline text-[#22D3EE]" href="https://www.aa.org/the-twelve-steps" target="_blank" rel="noreferrer">AA.org</a> for the source text and meetings.
        </p>
      </div>
    </div>
  );
}
