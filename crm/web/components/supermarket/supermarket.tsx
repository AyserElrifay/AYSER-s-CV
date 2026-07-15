"use client";

import { useState } from "react";
import { BedDouble, Maximize, MapPin, Building2, Check } from "lucide-react";
import { cn, egp } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { units, type Unit } from "@/lib/mock-data";

const TYPES = ["الكل", "شقة", "فيلا", "شاليه", "تجاري"] as const;
const AREAS = ["كل المناطق", "التجمع الخامس", "الشيخ زايد", "الساحل الشمالي"] as const;

export function Supermarket() {
  const [type, setType] = useState<(typeof TYPES)[number]>("الكل");
  const [area, setArea] = useState<(typeof AREAS)[number]>("كل المناطق");

  const filtered = units.filter(
    (u) =>
      (type === "الكل" || u.type === type) &&
      (area === "كل المناطق" || u.area === area)
  );

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-border bg-card p-3 shadow-card">
        <FilterGroup label="النوع">
          {TYPES.map((t) => (
            <Chip key={t} active={type === t} onClick={() => setType(t)}>
              {t}
            </Chip>
          ))}
        </FilterGroup>
        <div className="hidden h-6 w-px bg-border sm:block" />
        <FilterGroup label="المنطقة">
          {AREAS.map((a) => (
            <Chip key={a} active={area === a} onClick={() => setArea(a)}>
              {a}
            </Chip>
          ))}
        </FilterGroup>
        <span className="ms-auto text-[12px] text-muted-foreground">
          {filtered.length} وحدة متاحة
        </span>
      </div>

      {/* Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((u) => (
          <UnitCard key={u.id} unit={u} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          لا توجد وحدات مطابقة — جرّب توسيع الفلترة.
        </div>
      )}
    </div>
  );
}

function UnitCard({ unit }: { unit: Unit }) {
  const sold = unit.status === "sold";
  const reserved = unit.status === "reserved";
  return (
    <div className={cn("group overflow-hidden rounded-xl border border-border bg-card shadow-card transition-shadow hover:shadow-pop", sold && "opacity-60")}>
      {/* Media */}
      <div className={cn("relative flex h-32 items-end bg-gradient-to-br p-3", unit.image)}>
        <Badge className="absolute end-2.5 top-2.5 bg-white/85 text-foreground backdrop-blur">
          {unit.type}
        </Badge>
        {(sold || reserved) && (
          <span className={cn(
            "absolute start-2.5 top-2.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
            sold ? "bg-foreground/80 text-white" : "bg-amber-500/90 text-white"
          )}>
            {sold ? "مباعة" : "محجوزة"}
          </span>
        )}
        <div className="text-[12px] font-medium text-foreground/70">{unit.code}</div>
      </div>

      {/* Body */}
      <div className="p-3.5">
        <div className="truncate text-[14px] font-semibold">{unit.project}</div>
        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Building2 className="h-3 w-3" />
          {unit.developer}
          <span className="mx-0.5">·</span>
          <MapPin className="h-3 w-3" />
          {unit.area}
        </div>

        <div className="mt-3 flex items-center gap-3 text-[12px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Maximize className="h-3.5 w-3.5" />
            {unit.sqm} م²
          </span>
          {unit.bedrooms > 0 && (
            <span className="flex items-center gap-1">
              <BedDouble className="h-3.5 w-3.5" />
              {unit.bedrooms} غرف
            </span>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="text-[15px] font-bold tabular-nums">{egp(unit.price)}</div>
          <Button
            size="sm"
            variant={sold ? "ghost" : "default"}
            disabled={sold}
            className="h-8"
          >
            {sold ? "غير متاحة" : reserved ? "استعلام" : (
              <>
                <Check className="h-3.5 w-3.5" />
                حجز
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] font-medium text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-[12.5px] transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-subtle/60 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
