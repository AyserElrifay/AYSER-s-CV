import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";

export function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "up";
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-muted-foreground">{label}</span>
        <Icon className="h-[18px] w-[18px] text-muted-foreground" />
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && (
        <div
          className={cn(
            "mt-1 text-[12px]",
            tone === "up" ? "text-emerald-600" : "text-muted-foreground"
          )}
        >
          {hint}
        </div>
      )}
    </div>
  );
}
