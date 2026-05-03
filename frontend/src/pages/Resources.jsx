import { useEffect, useState } from "react";
import { api } from "../lib/api";
import Navbar from "../components/Navbar";
import { ExternalLink, ShieldAlert, BookOpen } from "lucide-react";

export default function Resources() {
  const [data, setData] = useState({ categories: [], resources: [] });
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    api.get("/resources").then(r => setData(r.data));
  }, []);

  const filtered = filter === "All" ? data.resources : data.resources.filter(r => r.category === filter);

  return (
    <div className="min-h-screen ambient-mesh">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="text-[11px] uppercase tracking-[0.22em] text-[#22D3EE] flex items-center gap-2"><BookOpen className="w-3 h-3" /> Resources</div>
        <h1 className="font-serif text-4xl lg:text-5xl text-white mt-1 leading-tight">Verified, curated, honest.</h1>
        <p className="text-sm text-slate-400 mt-2 max-w-2xl">Free, public, evidence-based starting points. We do not receive any commission for these.</p>

        <div className="mt-6 flex gap-2 flex-wrap" data-testid="resource-filters">
          {["All", ...data.categories].map((c) => (
            <button key={c} onClick={() => setFilter(c)}
              className={`px-3 py-1 text-xs rounded-md border transition-colors ${filter === c ? "border-[#0F766E]/60 bg-[#0F766E]/15 text-white" : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"}`}
              data-testid={`filter-${c}`}>
              {c}
            </button>
          ))}
        </div>

        <div className="mt-6 grid md:grid-cols-2 gap-4">
          {filtered.map((r) => (
            <a key={r.id} href={r.link} target="_blank" rel="noreferrer"
              className="glass rounded-xl p-5 hover:bg-white/[0.07] transition-colors group" data-testid={`resource-${r.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="text-[10px] uppercase tracking-widest text-[#22D3EE] flex items-center gap-2">
                    {r.crisis && <span className="inline-flex items-center gap-1 text-rose-300"><ShieldAlert className="w-3 h-3" /> Crisis</span>}
                    <span>{r.category}</span>
                  </div>
                  <h3 className="font-serif text-xl text-white mt-1 leading-snug group-hover:text-[#22D3EE] transition-colors">{r.title}</h3>
                  <p className="text-sm text-slate-400 mt-2 leading-relaxed">{r.description}</p>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-[#22D3EE] transition-colors mt-1 shrink-0" />
              </div>
            </a>
          ))}
        </div>

        <p className="text-[11px] text-slate-500 mt-10 leading-relaxed border-t border-white/5 pt-4">
          This list is not exhaustive. It is for support and educational purposes. It is not medical advice.
        </p>
      </div>
    </div>
  );
}
