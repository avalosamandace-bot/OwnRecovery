import { AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import { Button } from "./ui/button";

const levelStyles = {
  low:    { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-200", Icon: CheckCircle2, iconColor: "text-emerald-400" },
  medium: { bg: "bg-amber-500/10",   border: "border-amber-500/30",   text: "text-amber-200",   Icon: Info,          iconColor: "text-amber-400" },
  high:   { bg: "bg-rose-500/10",    border: "border-rose-500/30",    text: "text-rose-200",    Icon: AlertTriangle, iconColor: "text-rose-400" },
};

export default function AlertCard({ alert, onAck }) {
  const s = levelStyles[alert.level] || levelStyles.low;
  const Icon = s.Icon;
  return (
    <div className={`rounded-lg border p-4 flex items-start gap-3 backdrop-blur-sm ${s.bg} ${s.border}`} data-testid={`alert-${alert.id}`}>
      <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${s.iconColor}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className={`font-medium text-sm ${s.text}`}>{alert.title}</h4>
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-black/30 text-slate-300 border border-white/5">{alert.level}</span>
        </div>
        <p className="text-sm text-slate-300 mt-1 leading-relaxed">{alert.description}</p>
        <div className="mt-2 text-xs text-slate-400 border-l-2 border-white/10 pl-2 italic">
          Suggested: {alert.suggested_action}
        </div>
        {!alert.acknowledged && onAck && (
          <Button size="sm" variant="ghost" className="mt-2 h-7 px-2 text-xs text-slate-300 hover:text-white hover:bg-white/5" onClick={() => onAck(alert.id)} data-testid={`ack-${alert.id}`}>
            Acknowledge
          </Button>
        )}
        {alert.acknowledged && <div className="text-[11px] text-slate-500 mt-2">Acknowledged</div>}
      </div>
    </div>
  );
}
