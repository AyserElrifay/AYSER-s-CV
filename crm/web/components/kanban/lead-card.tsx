"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Phone, Clock, Sparkles, MapPin } from "lucide-react";
import { cn, egp, initials } from "@/lib/utils";
import { agents, type Lead } from "@/lib/mock-data";

function qualityTone(q: number) {
  if (q >= 80) return "bg-emerald-50 text-emerald-700";
  if (q >= 65) return "bg-amber-50 text-amber-700";
  return "bg-secondary text-muted-foreground";
}

export function LeadCard({ lead, onOpen }: { lead: Lead; onOpen: (lead: Lead) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
  });
  const agent = agents.find((a) => a.id === lead.agentId);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...listeners}
      {...attributes}
      onClick={() => onOpen(lead)}
      className={cn(
        "group cursor-grab touch-none rounded-lg border border-border bg-card p-3 shadow-card transition-shadow active:cursor-grabbing hover:shadow-pop",
        isDragging && "opacity-40"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-medium">{lead.name}</div>
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {lead.area}
          </div>
        </div>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums", qualityTone(lead.quality))}>
          {lead.quality}
        </span>
      </div>

      <div className="mt-2.5 text-[12px] font-medium tabular-nums text-foreground/80">
        {egp(lead.budgetMin)} – {egp(lead.budgetMax)}
      </div>

      {lead.aiTip && (
        <div className="mt-2 flex items-start gap-1.5 rounded-md bg-primary/5 px-2 py-1.5 text-[11px] leading-snug text-primary/90">
          <Sparkles className="mt-0.5 h-3 w-3 shrink-0" />
          <span className="line-clamp-2">{lead.aiTip}</span>
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground">
            {lead.source}
          </span>
          {lead.slaMinutes !== undefined && (
            <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
              <Clock className="h-3 w-3" />
              {lead.slaMinutes} د
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => e.stopPropagation()}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition hover:bg-subtle hover:text-primary group-hover:opacity-100"
          >
            <Phone className="h-3.5 w-3.5" />
          </button>
          <span
            title={agent?.name}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-[10px] font-medium text-secondary-foreground"
          >
            {initials(agent?.name ?? "")}
          </span>
        </div>
      </div>
    </div>
  );
}
