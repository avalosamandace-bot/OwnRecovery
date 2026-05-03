import { ShieldQuestion } from "lucide-react";

const cfg = {
  high: { color: "#10B981", label: "High confidence" },
  medium: { color: "#F59E0B", label: "Medium confidence" },
  low: { color: "#EF4444", label: "Low confidence" },
};

export default function RiskConfidenceBadge({ confidence }) {
  if (!confidence) return null;
  const c = cfg[confidence.level] || cfg.medium;
  return (
    <div
      className="inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-md border"
      style={{ color: c.color, borderColor: c.color + "55", background: c.color + "10" }}
      title={confidence.reasons?.[0] || ""}
      data-testid="risk-confidence"
    >
      <ShieldQuestion className="w-3 h-3" />
      {c.label}
      {confidence.n_entries !== undefined && (
        <span className="font-mono opacity-70">· n={confidence.n_entries}</span>
      )}
    </div>
  );
}
