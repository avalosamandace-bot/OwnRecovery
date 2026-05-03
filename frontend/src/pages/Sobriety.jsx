import { useEffect, useState } from "react";
import { api } from "../lib/api";
import Navbar from "../components/Navbar";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { Flame, Heart, Anchor, AlertTriangle, Trophy } from "lucide-react";

export default function Sobriety() {
  const [status, setStatus] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [why, setWhy] = useState("");
  const [tags, setTags] = useState("");
  const [relapseDate, setRelapseDate] = useState("");
  const [relapseNote, setRelapseNote] = useState("");
  const [confirming, setConfirming] = useState(false);

  const load = async () => {
    const { data } = await api.get("/sobriety/status");
    setStatus(data);
    setStartDate(data.sobriety_start_date || "");
    setWhy(data.why_i_am_sober || "");
    setTags((data.motivation_tags || []).join(", "));
  };
  useEffect(() => { load(); }, []);

  const saveStart = async () => {
    if (!startDate) return;
    try {
      await api.post("/sobriety/start", { start_date: startDate });
      toast.success("Sobriety start date set.");
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Could not save"); }
  };
  const saveWhy = async () => {
    if (!why.trim()) return;
    try {
      await api.post("/sobriety/why", {
        why_i_am_sober: why.trim(),
        motivation_tags: tags.split(",").map(s => s.trim()).filter(Boolean),
      });
      toast.success("Anchor saved.");
      load();
    } catch (e) { toast.error("Could not save"); }
  };
  const logRelapse = async () => {
    try {
      const { data } = await api.post("/sobriety/relapse", {
        date: relapseDate || undefined, note: relapseNote || "",
      });
      toast.success(data.supportive_message);
      setConfirming(false);
      setRelapseNote("");
      setRelapseDate("");
      load();
    } catch { toast.error("Could not log relapse"); }
  };

  if (!status) return <div className="min-h-screen ambient-mesh"><Navbar /><div className="p-10 text-slate-400">Loading…</div></div>;

  return (
    <div className="min-h-screen ambient-mesh">
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-[#22D3EE] flex items-center gap-2"><Flame className="w-3 h-3" /> Sobriety</div>
          <h1 className="font-serif text-4xl lg:text-5xl text-white mt-1 leading-tight">Your streak. Your anchor. Your reset.</h1>
        </div>

        {/* Streak summary */}
        <div className="glass rounded-xl p-6 grid sm:grid-cols-3 gap-6">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500">Current streak</div>
            <div className="font-serif text-5xl text-white mt-1">{status.current_streak_days}<span className="text-base text-slate-400 ml-2">days</span></div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500">Longest streak</div>
            <div className="font-serif text-5xl text-white mt-1">{status.longest_streak_days}<span className="text-base text-slate-400 ml-2">days</span></div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500">Milestones</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(status.milestones_reached || []).map((m) => (
                <span key={m} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#0F766E]/15 border border-[#0F766E]/30 text-[#5EEAD4]"><Trophy className="w-3 h-3" /> {m}d</span>
              ))}
              {(!status.milestones_reached || status.milestones_reached.length === 0) && <span className="text-xs text-slate-500 italic">First milestone at 1 day.</span>}
            </div>
          </div>
        </div>

        {/* Start date */}
        <section className="glass rounded-xl p-6">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#22D3EE]"><Flame className="w-3 h-3" /> Start date</div>
          <h2 className="font-serif text-2xl text-white mt-1">When did you begin?</h2>
          <p className="text-xs text-slate-400 mt-1">An honest date, even if recent. The streak adjusts to whatever you set.</p>
          <div className="mt-4 flex gap-2 max-w-sm">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-white/5 border-white/10 text-white" data-testid="start-date" />
            <Button onClick={saveStart} className="bg-[#0F766E] hover:bg-[#115e59]" data-testid="save-start">Save</Button>
          </div>
        </section>

        {/* Why I'm sober */}
        <section className="glass rounded-xl p-6">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#22D3EE]"><Anchor className="w-3 h-3" /> Why I'm sober</div>
          <h2 className="font-serif text-2xl text-white mt-1">Your anchor.</h2>
          <p className="text-xs text-slate-400 mt-1">One sentence. We surface this on high-risk days, during cravings, and after a slip.</p>
          <Textarea rows={3} value={why} onChange={(e) => setWhy(e.target.value)} maxLength={600}
            className="mt-3 bg-white/5 border-white/10 text-white" placeholder="For my future. For the people I love. For myself."
            data-testid="why-input" />
          <div className="mt-3">
            <Label className="text-xs uppercase tracking-wider text-slate-400">Motivation tags (comma-separated)</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="family, future, health" className="mt-1 bg-white/5 border-white/10 text-white" data-testid="tags-input" />
          </div>
          <div className="mt-4">
            <Button onClick={saveWhy} className="bg-[#0F766E] hover:bg-[#115e59]" data-testid="save-why">Save anchor</Button>
          </div>
        </section>

        {/* Relapse history */}
        <section className="glass rounded-xl p-6">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#22D3EE]"><Heart className="w-3 h-3" /> Relapse history</div>
          <h2 className="font-serif text-2xl text-white mt-1">Honest, not punitive.</h2>
          <p className="text-xs text-slate-400 mt-1">Logging a relapse resets the streak and unlocks a supportive recovery flow.</p>
          {(status.relapse_history || []).length === 0 && <div className="text-sm text-slate-500 mt-3 italic">No relapses logged.</div>}
          <div className="mt-3 space-y-2">
            {(status.relapse_history || []).map((r) => (
              <div key={r.id} className="flex justify-between items-start rounded-lg border border-white/5 bg-white/5 p-3" data-testid={`relapse-${r.id}`}>
                <div>
                  <div className="text-sm text-slate-200 font-mono">{r.date}</div>
                  {r.note && <div className="text-xs text-slate-400 mt-1">{r.note}</div>}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 border-t border-white/5 pt-5">
            {!confirming ? (
              <Button variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/15 hover:text-white" onClick={() => setConfirming(true)} data-testid="open-relapse">
                <AlertTriangle className="w-4 h-4 mr-1" /> Log a relapse
              </Button>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-slate-400">Date (defaults to today)</Label>
                  <Input type="date" value={relapseDate} onChange={(e) => setRelapseDate(e.target.value)} className="mt-1 bg-white/5 border-white/10 text-white max-w-xs" data-testid="relapse-date" />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-slate-400">Note (optional, private)</Label>
                  <Textarea rows={3} value={relapseNote} onChange={(e) => setRelapseNote(e.target.value)} placeholder="What happened, what you noticed — just for you." className="mt-1 bg-white/5 border-white/10 text-white" data-testid="relapse-note" />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => setConfirming(false)}>Cancel</Button>
                  <Button onClick={logRelapse} className="bg-amber-600 hover:bg-amber-700 text-white" data-testid="confirm-relapse">Save & enter recovery mode</Button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
