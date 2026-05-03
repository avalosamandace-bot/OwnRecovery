import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import Navbar from "../components/Navbar";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { Slider } from "../components/ui/slider";
import { toast } from "sonner";
import { Heart, Target, BookOpenText, ArrowRight, Sparkles } from "lucide-react";

export default function Onboarding() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [feelingToday, setFeelingToday] = useState("");
  const [hardest, setHardest] = useState("");
  const [sleepQuality, setSleepQuality] = useState("okay");
  const [stressLevel, setStressLevel] = useState([5]);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/onboarding/plan", {
        feeling_today: feelingToday,
        hardest_recently: hardest,
        sleep_quality: sleepQuality,
        stress_level: stressLevel[0],
      });
      setPlan(data);
      setStep(4);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not generate plan");
    } finally { setLoading(false); }
  };

  const next = () => setStep((s) => s + 1);

  const steps = [
    {
      title: "How are you feeling today?",
      sub: "One or two words is enough. No right answer.",
      node: (
        <Textarea value={feelingToday} onChange={(e) => setFeelingToday(e.target.value)}
          rows={3} placeholder="tired, okay, anxious, hopeful…"
          className="bg-white/5 border-white/10 text-white text-base" data-testid="onb-feeling" />
      ),
      canNext: feelingToday.trim().length > 0,
    },
    {
      title: "What has been hardest recently?",
      sub: "Naming it matters. This stays private.",
      node: (
        <Textarea value={hardest} onChange={(e) => setHardest(e.target.value)}
          rows={4} placeholder="A situation, a feeling, a person, the nights, the mornings…"
          className="bg-white/5 border-white/10 text-white text-base" data-testid="onb-hardest" />
      ),
      canNext: hardest.trim().length > 0,
    },
    {
      title: "How is your sleep?",
      sub: "Rough ballpark — we'll refine later.",
      node: (
        <RadioGroup value={sleepQuality} onValueChange={setSleepQuality} className="space-y-2">
          {[
            ["poor", "Rough. Short nights or waking often."],
            ["okay", "Up and down. Some good, some bad."],
            ["good", "Mostly solid."],
          ].map(([v, d]) => (
            <label key={v} className={`flex gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${sleepQuality === v ? "border-[#0F766E]/60 bg-[#0F766E]/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`} data-testid={`onb-sleep-${v}`}>
              <RadioGroupItem value={v} className="mt-0.5" />
              <div>
                <div className="text-sm font-medium text-white capitalize">{v}</div>
                <div className="text-xs text-slate-400 mt-0.5">{d}</div>
              </div>
            </label>
          ))}
        </RadioGroup>
      ),
      canNext: true,
    },
    {
      title: "Current stress level?",
      sub: "Right now, not on average.",
      node: (
        <div>
          <div className="flex justify-between items-baseline mb-3">
            <Label className="text-xs text-slate-400">1 calm · 10 overwhelmed</Label>
            <span className="font-serif text-4xl text-[#22D3EE]" data-testid="onb-stress-val">{stressLevel[0]}</span>
          </div>
          <Slider min={1} max={10} step={1} value={stressLevel} onValueChange={setStressLevel} data-testid="onb-stress" />
        </div>
      ),
      canNext: true,
    },
  ];

  return (
    <div className="min-h-screen ambient-mesh">
      <Navbar />
      <div className="max-w-2xl mx-auto px-6 py-10">
        {step < 4 && (
          <>
            <div className="text-[11px] uppercase tracking-[0.22em] text-[#22D3EE] mb-3 flex items-center gap-2">
              <Heart className="w-3 h-3" /> Guided onboarding · {step + 1} of 4
            </div>
            <h1 className="font-serif text-4xl lg:text-5xl tracking-tight text-white leading-tight">
              {steps[step].title}
            </h1>
            <p className="text-sm text-slate-400 mt-3">{steps[step].sub}</p>

            <div className="mt-8 glass rounded-xl p-6" data-testid={`onb-step-${step}`}>
              {steps[step].node}
            </div>

            <div className="mt-6 flex justify-between items-center">
              <div className="flex gap-1.5">
                {steps.map((_, i) => (
                  <div key={i} className={`h-1 w-10 rounded-full ${i <= step ? "bg-[#22D3EE]" : "bg-white/10"}`} />
                ))}
              </div>
              {step < 3 ? (
                <Button onClick={next} disabled={!steps[step].canNext} className="bg-[#0F766E] hover:bg-[#115e59]" data-testid="onb-next">
                  Continue <ArrowRight className="ml-1 w-4 h-4" />
                </Button>
              ) : (
                <Button onClick={generate} disabled={loading} className="bg-[#0F766E] hover:bg-[#115e59] shadow-[0_0_24px_rgba(15,118,110,0.35)]" data-testid="onb-generate">
                  {loading ? "Thinking…" : <>Generate my Day 1 plan <Sparkles className="ml-1 w-4 h-4" /></>}
                </Button>
              )}
            </div>
          </>
        )}

        {step === 4 && plan && (
          <div className="fade-up">
            <div className="text-[11px] uppercase tracking-[0.22em] text-[#22D3EE] mb-3 flex items-center gap-2">
              <Sparkles className="w-3 h-3" /> Day 1 plan
            </div>
            <h1 className="font-serif text-4xl lg:text-5xl tracking-tight text-white leading-tight">
              Start here.<br /><span className="italic text-[#22D3EE]">You're not alone.</span>
            </h1>

            <div className="mt-8 grid gap-4">
              <div className="glass rounded-xl p-6" data-testid="plan-goal">
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#22D3EE]">
                  <Target className="w-3.5 h-3.5" /> One small goal
                </div>
                <p className="font-serif text-2xl text-white mt-2 leading-snug">{plan.small_goal}</p>
              </div>

              <div className="glass rounded-xl p-6" data-testid="plan-checkin">
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#22D3EE]">
                  <Heart className="w-3.5 h-3.5" /> Try this today
                </div>
                <p className="text-base text-slate-200 mt-2 leading-relaxed">{plan.suggested_checkin}</p>
              </div>

              <div className="glass rounded-xl p-6" data-testid="plan-resource">
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#22D3EE]">
                  <BookOpenText className="w-3.5 h-3.5" /> A resource that may help
                </div>
                <a href={plan.recommended_resource.link} target="_blank" rel="noreferrer" className="block mt-2 group">
                  <div className="text-base font-medium text-white group-hover:text-[#22D3EE] transition-colors">{plan.recommended_resource.title} →</div>
                  <div className="text-sm text-slate-400 mt-1 leading-relaxed">{plan.recommended_resource.why}</div>
                </a>
              </div>

              <div className="rounded-xl p-6 border border-[#22D3EE]/20 bg-[#22D3EE]/5">
                <p className="font-serif text-xl text-white italic" data-testid="plan-affirmation">{plan.affirmation}</p>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <Button onClick={() => nav("/app")} className="bg-[#0F766E] hover:bg-[#115e59]" data-testid="onb-done">
                Go to my dashboard <ArrowRight className="ml-1 w-4 h-4" />
              </Button>
              <Button variant="outline" onClick={() => nav("/app/checkin")} className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white" data-testid="onb-checkin">
                Log my first check-in
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
