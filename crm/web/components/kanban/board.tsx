"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { LeadCard } from "./lead-card";
import { LeadDrawer } from "@/components/lead-drawer";
import { STAGES, leads as seedLeads, type Lead, type Stage } from "@/lib/mock-data";
import { egp } from "@/lib/utils";

export function KanbanBoard() {
  const [leads, setLeads] = useState<Lead[]>(seedLeads);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openLead, setOpenLead] = useState<Lead | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const byStage = useMemo(() => {
    const map: Record<Stage, Lead[]> = {
      new: [], contacted: [], qualified: [], negotiation: [], won: [],
    };
    for (const l of leads) map[l.stage].push(l);
    return map;
  }, [leads]);

  const activeLead = leads.find((l) => l.id === activeId) ?? null;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const targetStage = String(over.id) as Stage;
    setLeads((prev) =>
      prev.map((l) =>
        l.id === active.id && STAGES.some((s) => s.id === targetStage)
          ? { ...l, stage: targetStage, slaMinutes: targetStage === "new" ? l.slaMinutes : undefined }
          : l
      )
    );
  }

  return (
    <>
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {STAGES.map((stage) => (
            <Column
              key={stage.id}
              stage={stage.id}
              label={stage.label}
              colorVar={stage.colorVar}
              leads={byStage[stage.id]}
              onOpen={setOpenLead}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeLead ? (
            <div className="w-72 rotate-2">
              <LeadCard lead={activeLead} onOpen={() => {}} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <LeadDrawer lead={openLead} onOpenChange={(o) => !o && setOpenLead(null)} />
    </>
  );
}

function Column({
  stage,
  label,
  colorVar,
  leads,
  onOpen,
}: {
  stage: Stage;
  label: string;
  colorVar: string;
  leads: Lead[];
  onOpen: (l: Lead) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const total = leads.reduce((s, l) => s + (l.budgetMin + l.budgetMax) / 2, 0);

  return (
    <div className="flex w-72 shrink-0 flex-col">
      {/* Column header */}
      <div className="mb-2 flex items-center gap-2 px-1">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: `hsl(var(${colorVar}))` }}
        />
        <span className="text-[13px] font-semibold">{label}</span>
        <span className="rounded-full bg-secondary px-1.5 text-[11px] font-medium tabular-nums text-muted-foreground">
          {leads.length}
        </span>
        <span className="ms-auto text-[11px] text-muted-foreground">
          {total > 0 ? egp(total) : "—"}
        </span>
      </div>

      {/* Droppable body */}
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 rounded-xl border border-transparent p-1.5 transition-colors ${
          isOver ? "border-primary/30 bg-primary/5" : "bg-subtle/40"
        }`}
      >
        {leads.map((l) => (
          <LeadCard key={l.id} lead={l} onOpen={onOpen} />
        ))}
        <button className="flex w-full items-center justify-center gap-1 rounded-lg py-2 text-[12px] text-muted-foreground transition-colors hover:bg-card hover:text-foreground">
          <Plus className="h-3.5 w-3.5" />
          إضافة
        </button>
      </div>
    </div>
  );
}
