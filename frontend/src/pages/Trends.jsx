import { useEffect, useState } from "react";
import { api } from "../lib/api";
import Navbar from "../components/Navbar";
import TrendChart from "../components/TrendChart";
import XAIPanel from "../components/XAIPanel";

export default function Trends() {
  const [entries, setEntries] = useState([]);
  const [risks, setRisks] = useState([]);
  const [compare, setCompare] = useState(null);
  const [days, setDays] = useState(30);

  const load = async (d) => {
    const [e, r, c] = await Promise.all([
      api.get(`/health/entries?days=${d}`),
      api.get(`/health/risk/series?days=${d}`),
      api.get("/health/risk/compare"),
    ]);
    setEntries(e.data);
    setRisks(r.data);
    setCompare(c.data);
  };
  useEffect(() => { load(days); }, [days]);

  return (
    <div className="min-h-screen ambient-mesh">
      <Navbar />
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-[#22D3EE]">Longitudinal view</div>
            <h1 className="font-serif text-4xl lg:text-5xl tracking-tight text-white mt-1">Trends &amp; patterns</h1>
            <p className="text-sm text-slate-400 mt-2">Time-series data across every tracked signal.</p>
          </div>
          <div className="flex gap-1 glass rounded-lg p-1" data-testid="range-toggle">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${days === d ? "bg-[#0F766E] text-white" : "text-slate-400 hover:text-white hover:bg-white/5"}`}
                data-testid={`range-${d}`}
              >{d} days</button>
            ))}
          </div>
        </div>

        <div className="mt-8 grid lg:grid-cols-2 gap-6">
          <TrendChart data={risks} dataKey="displayed_score" ma7Key="ma7" label="Relapse risk score" color="#22D3EE" yDomain={[0, 100]} />
          <TrendChart data={entries} dataKey="mood" label="Mood (1-10)" color="#10B981" yDomain={[0, 10]} />
          <TrendChart data={entries} dataKey="sleep_hours" label="Sleep (hours)" color="#4F46E5" yDomain={[0, 12]} />
          <TrendChart data={entries} dataKey="stress" label="Stress (1-10)" color="#F59E0B" yDomain={[0, 10]} />
          <TrendChart data={entries} dataKey="craving" label="Craving intensity (0-10)" color="#EF4444" yDomain={[0, 10]} />
        </div>

        {compare && (
          <div className="mt-12">
            <div className="flex items-baseline justify-between flex-wrap">
              <h2 className="font-serif text-3xl text-white">Model comparison</h2>
              <span className="text-xs text-slate-500 font-mono">Entry {compare.entry_date}</span>
            </div>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl">
              The rule-based engine is the primary, displayed score. A scikit-learn logistic regression model runs alongside for cross-reference and future ML expansion. Both are transparent — each feature's contribution is shown.
            </p>
            <div className="mt-6 grid lg:grid-cols-2 gap-6">
              <div>
                <div className="flex items-baseline justify-between mb-3 px-1">
                  <div className="text-sm font-medium text-white">Rule-based <span className="text-slate-500 text-xs">(primary)</span></div>
                  <div className="font-serif text-4xl text-[#22D3EE]">{compare.rule.score}</div>
                </div>
                <XAIPanel contributions={compare.rule.contributions} narrative={`Rule-based risk: ${compare.rule.score}/100 (${compare.rule.level}).`} title="Rule-based contributions" />
              </div>
              <div>
                <div className="flex items-baseline justify-between mb-3 px-1">
                  <div className="text-sm font-medium text-white">Logistic regression <span className="text-slate-500 text-xs">(experimental)</span></div>
                  <div className="font-serif text-4xl text-slate-300">{compare.ml.score}</div>
                </div>
                <XAIPanel contributions={compare.ml.contributions} narrative="Learned feature coefficients applied to current inputs. Values scaled for comparison." title="ML contributions" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
