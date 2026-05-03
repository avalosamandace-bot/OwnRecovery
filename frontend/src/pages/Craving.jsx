import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import Navbar from "../components/Navbar";
import { Button } from "../components/ui/button";
import { Slider } from "../components/ui/slider";
import { Textarea } from "../components/ui/textarea";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { Wind, Waves, Film, Phone, Anchor, Droplets, Sun, MessageSquare, Timer } from "lucide-react";

const TRIGGERS = ["stress", "loneliness", "boredom", "conflict", "social pressure", "money", "grief", "fatigue", "anxiety", "celebration", "physical pain", "lack of sleep"];

const MICRO = [
  { id: "breathing", title: "Take 3 deep breaths", Icon: Wind },
  { id: "water", title: "Drink water", Icon: Droplets },
  { id: "outside", title: "Step outside 2 min", Icon: Sun },
  { id: "message", title: "Message someone", Icon: MessageSquare },
];

function UrgeSurfTimer({ onDone }) {
  const [duration, setDuration] = useState(120); // seconds
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(120);
  const ref = useRef();

  useEffect(() => { setRemaining(duration); }, [duration]);

  useEffect(() => {
    if (running) {
      ref.current = setInterval(() => {
        setRemaining((r) => {
          if (r <= 1) { clearInterval(ref.current); setRunning(false); onDone?.(); return 0; }
          return r - 1;
        });
      }, 1000);
      return () => clearInterval(ref.current);
    }
  }, [running, onDone]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const pct = duration > 0 ? ((duration - remaining) / duration) * 100 : 0;

  return (
    <div className="glass rounded-xl p-6" data-testid="urge-surf">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#22D3EE]"><Waves className="w-3 h-3" /> Urge surfing</div>
      <p className="text-sm text-slate-300 mt-2 leading-relaxed italic">"Cravings rise, peak, and pass. Let's ride this out."</p>
      <div className="mt-4 flex gap-2">
        {[120, 300, 600].map((s) => (
          <button key={s} disabled={running} onClick={() => setDuration(s)}
            className={`px-3 py-1.5 rounded-md text-xs border transition-colors ${duration === s ? "border-[#0F766E]/60 bg-[#0F766E]/15 text-white" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`}
            data-testid={`urge-${s}`}>
            {s / 60} min
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-col items-center">
        <div className="font-mono text-5xl text-white tracking-wider" data-testid="urge-clock">{mm}:{ss}</div>
        <div className="mt-3 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#0F766E] to-[#22D3EE] rounded-full transition-all duration-1000" style={{ width: `${pct}%` }} />
        </div>
        {!running ? (
          <Button onClick={() => setRunning(true)} className="mt-4 bg-[#0F766E] hover:bg-[#115e59]" data-testid="urge-start">Start</Button>
        ) : (
          <Button variant="outline" onClick={() => setRunning(false)} className="mt-4 border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white">Pause</Button>
        )}
      </div>
    </div>
  );
}

function TapeForward({ onSaved }) {
  const [q, setQ] = useState({ q1_if_use: "", q2_what_happens_after: "", q3_how_tomorrow: "", q4_safer_choice: "" });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!q.q1_if_use || !q.q2_what_happens_after || !q.q3_how_tomorrow || !q.q4_safer_choice) {
      toast.error("Answer all four prompts honestly. Even short answers help."); return;
    }
    setSaving(true);
    try {
      await api.post("/craving/tape-forward", q);
      toast.success("Saved. You walked it through.");
      onSaved?.();
      setQ({ q1_if_use: "", q2_what_happens_after: "", q3_how_tomorrow: "", q4_safer_choice: "" });
    } catch { toast.error("Could not save"); }
    finally { setSaving(false); }
  };
  const Q = (key, label) => (
    <div>
      <Label className="text-xs uppercase tracking-wider text-slate-400">{label}</Label>
      <Textarea rows={2} value={q[key]} onChange={(e) => setQ((s) => ({ ...s, [key]: e.target.value }))} className="mt-1 bg-white/5 border-white/10 text-white" data-testid={`tape-${key}`} />
    </div>
  );
  return (
    <div className="glass rounded-xl p-6" data-testid="tape-forward">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#22D3EE]"><Film className="w-3 h-3" /> Play the tape forward</div>
      <p className="text-sm text-slate-300 mt-2 leading-relaxed">A gentle, accountable walk-through. Not fear-based. Not shame-based.</p>
      <div className="mt-4 space-y-3">
        {Q("q1_if_use", "1. What do I think will happen if I use right now?")}
        {Q("q2_what_happens_after", "2. What usually happens after?")}
        {Q("q3_how_tomorrow", "3. How will I feel tomorrow?")}
        {Q("q4_safer_choice", "4. What is one safer choice right now?")}
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={submit} disabled={saving} className="bg-[#0F766E] hover:bg-[#115e59]" data-testid="tape-save">{saving ? "Saving…" : "Save reflection"}</Button>
      </div>
    </div>
  );
}

export default function Craving() {
  const [level, setLevel] = useState([5]);
  const [trigger, setTrigger] = useState("");
  const [note, setNote] = useState("");
  const [checkin, setCheckin] = useState(null); // saved checkin
  const [after, setAfter] = useState([5]);
  const [savingCheckin, setSavingCheckin] = useState(false);

  const submit = async (e) => {
    e?.preventDefault?.();
    setSavingCheckin(true);
    try {
      const { data } = await api.post("/craving/checkin", {
        level_before: level[0], trigger, note,
      });
      setCheckin(data);
      setAfter([level[0]]);
      toast.success("Logged. The craving is data — not destiny.");
    } catch { toast.error("Could not save"); }
    finally { setSavingCheckin(false); }
  };

  const recordAfter = async (intervention) => {
    if (!checkin) return;
    try {
      await api.patch(`/craving/checkin/${checkin.id}/after`, {
        level_after: after[0], intervention_used: intervention || "self",
      });
      toast.success(`Recorded. Δ ${checkin.level_before - after[0]}.`);
      setCheckin(null);
    } catch { toast.error("Could not save"); }
  };

  return (
    <div className="min-h-screen ambient-mesh">
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-[#22D3EE] flex items-center gap-2"><Anchor className="w-3 h-3" /> Craving toolkit</div>
          <h1 className="font-serif text-4xl lg:text-5xl text-white mt-1 leading-tight">Right now.</h1>
          <p className="text-sm text-slate-400 mt-2 max-w-2xl">Log it. Ride it. Reflect on it. You don't have to figure it all out in this moment.</p>
        </div>

        {!checkin && (
          <form onSubmit={submit} className="glass rounded-xl p-6 space-y-5" data-testid="craving-form">
            <div>
              <div className="flex justify-between items-baseline">
                <Label className="text-sm font-medium text-white">Craving intensity right now</Label>
                <span className="font-serif text-3xl text-[#22D3EE]" data-testid="cl">{level[0]}</span>
              </div>
              <Slider min={0} max={10} step={1} value={level} onValueChange={setLevel} className="mt-3" data-testid="cl-slider" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-slate-400">Trigger</Label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {TRIGGERS.map((t) => (
                  <button type="button" key={t} onClick={() => setTrigger(t)}
                    className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${trigger === t ? "border-[#0F766E]/60 bg-[#0F766E]/15 text-white" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`}
                    data-testid={`ct-${t.replace(/ /g, '-')}`}>{t}</button>
                ))}
              </div>
              <Input value={trigger} onChange={(e) => setTrigger(e.target.value)} placeholder="or type your own" className="mt-2 bg-white/5 border-white/10 text-white" data-testid="ct-custom" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-slate-400">Note (optional)</Label>
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 bg-white/5 border-white/10 text-white" data-testid="cn" />
            </div>
            <Button type="submit" disabled={savingCheckin} className="bg-[#0F766E] hover:bg-[#115e59]" data-testid="cravings-submit">{savingCheckin ? "Saving…" : "Log craving check-in"}</Button>
          </form>
        )}

        {checkin && (
          <>
            <div className="glass rounded-xl p-5 border border-[#22D3EE]/20 bg-[#22D3EE]/5">
              <div className="text-[10px] uppercase tracking-widest text-[#22D3EE]">Logged · level {checkin.level_before}/10</div>
              <p className="font-serif text-xl text-white mt-1 leading-snug">Pick a tool. Even one minute counts.</p>
            </div>
            <UrgeSurfTimer />
            <TapeForward onSaved={() => {}} />
            <div className="glass rounded-xl p-5">
              <div className="text-[10px] uppercase tracking-widest text-[#22D3EE]">Quick interventions</div>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {MICRO.map((m) => (
                  <button key={m.id} className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-3 text-sm text-slate-200 flex items-center gap-2" data-testid={`micro-${m.id}`}>
                    <m.Icon className="w-4 h-4 text-[#22D3EE]" /> {m.title}
                  </button>
                ))}
              </div>
            </div>
            <div className="glass rounded-xl p-5" data-testid="craving-after">
              <div className="text-[10px] uppercase tracking-widest text-[#22D3EE]">After — how is it now?</div>
              <div className="mt-3 flex justify-between items-baseline">
                <Label className="text-sm text-white">Craving intensity now</Label>
                <span className="font-serif text-3xl text-[#22D3EE]">{after[0]}</span>
              </div>
              <Slider min={0} max={10} step={1} value={after} onValueChange={setAfter} className="mt-2" data-testid="ca-slider" />
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => recordAfter("urge_surfing")} className="bg-[#0F766E] hover:bg-[#115e59]" data-testid="record-after">Record outcome</Button>
                <a href="tel:988" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm border border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/15"><Phone className="w-3.5 h-3.5" /> Call 988 instead</a>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
