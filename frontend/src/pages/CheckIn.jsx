import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import Navbar from "../components/Navbar";
import { Button } from "../components/ui/button";
import { Slider } from "../components/ui/slider";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Checkbox } from "../components/ui/checkbox";
import { toast } from "sonner";

const TRIGGERS = [
  "work stress", "social event", "argument", "loneliness",
  "fatigue", "negative thought", "physical pain", "financial worry",
];

export default function CheckIn() {
  const nav = useNavigate();
  const [mood, setMood] = useState([6]);
  const [craving, setCraving] = useState([3]);
  const [stress, setStress] = useState([5]);
  const [sleep, setSleep] = useState(7);
  const [triggers, setTriggers] = useState([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const toggleTrigger = (t) => {
    setTriggers((prev) => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post("/health/checkin", {
        mood: mood[0], craving: craving[0], stress: stress[0],
        sleep_hours: Number(sleep), triggers, notes,
      });
      toast.success(`Check-in recorded. Risk: ${data.risk.displayed_score} (${data.risk.level}).`);
      nav("/app");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not save check-in");
    } finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen ambient-mesh">
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="text-[11px] uppercase tracking-[0.22em] text-[#22D3EE]">Daily Check-in</div>
        <h1 className="font-serif text-4xl lg:text-5xl tracking-tight text-white mt-1">How has today been?</h1>
        <p className="text-sm text-slate-400 mt-2">Five quick inputs. Your honest numbers are more useful than ideal ones.</p>

        <form onSubmit={submit} className="mt-8 glass rounded-xl p-6 lg:p-8 space-y-8" data-testid="checkin-form">
          <div>
            <div className="flex justify-between items-baseline">
              <Label className="text-sm font-medium text-white">Mood <span className="text-slate-500 text-xs">(1 low · 10 high)</span></Label>
              <span className="text-3xl font-serif text-[#22D3EE]" data-testid="mood-value">{mood[0]}</span>
            </div>
            <Slider min={1} max={10} step={1} value={mood} onValueChange={setMood} className="mt-3" data-testid="mood-slider" />
          </div>

          <div>
            <div className="flex justify-between items-baseline">
              <Label className="text-sm font-medium text-white">Craving intensity <span className="text-slate-500 text-xs">(0 none · 10 intense)</span></Label>
              <span className="text-3xl font-serif text-[#22D3EE]" data-testid="craving-value">{craving[0]}</span>
            </div>
            <Slider min={0} max={10} step={1} value={craving} onValueChange={setCraving} className="mt-3" data-testid="craving-slider" />
          </div>

          <div>
            <div className="flex justify-between items-baseline">
              <Label className="text-sm font-medium text-white">Stress <span className="text-slate-500 text-xs">(1 calm · 10 overwhelmed)</span></Label>
              <span className="text-3xl font-serif text-[#22D3EE]" data-testid="stress-value">{stress[0]}</span>
            </div>
            <Slider min={1} max={10} step={1} value={stress} onValueChange={setStress} className="mt-3" data-testid="stress-slider" />
          </div>

          <div>
            <Label htmlFor="sleep" className="text-sm font-medium text-white">Sleep last night <span className="text-slate-500 text-xs">(hours)</span></Label>
            <Input id="sleep" type="number" min={0} max={16} step={0.1} value={sleep} onChange={(e) => setSleep(e.target.value)} className="mt-2 max-w-[140px] font-mono bg-white/5 border-white/10 text-white" data-testid="sleep-input" />
          </div>

          <div>
            <Label className="text-sm font-medium text-white">Trigger events today</Label>
            <p className="text-xs text-slate-400 mt-1">Select any that apply. These inform pattern detection, not blame.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
              {TRIGGERS.map((t) => (
                <label key={t} className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm cursor-pointer transition-colors ${triggers.includes(t) ? "border-[#0F766E]/60 bg-[#0F766E]/10 text-white" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`} data-testid={`trigger-${t.replace(/ /g,'-')}`}>
                  <Checkbox checked={triggers.includes(t)} onCheckedChange={() => toggleTrigger(t)} />
                  {t}
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="notes" className="text-sm font-medium text-white">Notes <span className="text-slate-500 text-xs">(private, optional)</span></Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-2 bg-white/5 border-white/10 text-white" placeholder="Anything worth remembering about today…" data-testid="notes-input" />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/5">
            <Button type="button" variant="outline" onClick={() => nav("/app")} className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white" data-testid="cancel-btn">Cancel</Button>
            <Button type="submit" disabled={saving} className="bg-[#0F766E] hover:bg-[#115e59] shadow-[0_0_24px_rgba(15,118,110,0.35)]" data-testid="submit-checkin">
              {saving ? "Recording…" : "Record check-in"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
