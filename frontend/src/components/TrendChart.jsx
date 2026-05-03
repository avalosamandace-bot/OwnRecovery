import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

export default function TrendChart({ data, dataKey, label, color = "#22D3EE", yDomain, height = 220, ma7Key }) {
  return (
    <div className="glass rounded-xl p-5" data-testid={`trend-${dataKey}`}>
      <div className="flex items-baseline justify-between mb-3">
        <h4 className="text-sm font-medium text-white">{label}</h4>
        <span className="text-[10px] uppercase tracking-widest text-slate-500">Time-series</span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" vertical={false} />
          <XAxis dataKey="entry_date" tick={{ fontSize: 10, fill: "#64748B" }} tickMargin={8} minTickGap={24} stroke="rgba(148,163,184,0.15)" />
          <YAxis tick={{ fontSize: 10, fill: "#64748B" }} domain={yDomain || ["auto", "auto"]} stroke="rgba(148,163,184,0.15)" />
          <Tooltip
            contentStyle={{ background: "#0F172A", border: "1px solid rgba(148,163,184,0.12)", borderRadius: 8, fontSize: 12, color: "#E2E8F0" }}
            labelStyle={{ color: "#94A3B8", fontSize: 11 }}
            itemStyle={{ color: "#E2E8F0" }}
          />
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={{ r: 2.5, fill: color }} activeDot={{ r: 4.5 }} />
          {ma7Key && (
            <Line type="monotone" dataKey={ma7Key} stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="4 3" dot={false} name="7-day avg" />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
