"use client";

import { useState } from "react";
import { BedDouble, Maximize, MapPin, Building2, Check, CalendarDays } from "lucide-react";
import { cn, egp } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LiveBadge } from "@/components/live-badge";
import { useLiveMarket } from "@/lib/use-live-market";
import { AREA_TICKER, MARKET_SOURCES, type PropType } from "@/lib/market-data";
import type { LiveUnit } from "@/lib/market";

const TYPES: (PropType | "الكل")[] = ["الكل", "شقة", "تاون هاوس", "توين هاوس", "فيلا", "شاليه", "تجاري"];
const AREAS = ["كل المناطق", ...AREA_TICKER.map((a) => a.area)];

export function Supermarket() {
  const { data } = useLiveMarket(15000);
  const [type, setType] = useState<(typeof TYPES)[number]>("الكل");
  const [area, setArea] = useState<string>("كل المناطق");
  const [onlyAvailable, setOnlyAvailable] = useState(true);

  const filtered = data.units.filter(
    (u) =>
      (type === "الكل" || u.type === type) &&
      (area === "كل المناطق" || u.area === area) &&
      (!onlyAvailable || u.status === "available")
  );

  const availableCount = data.units.filter((u) => u.status === "available").length;

  return (
    <div className="space-y-4">
      {/* Live availability strip */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card">
        <LiveBadge updatedAt={data.updatedAt} />
        <span className="text-[12px] text-muted-foreground">
          الإتاحة تُحدَّث تلقائياً كل ١٥ ثانية
        </span>
        <div className="ms-auto flex items-center gap-4 text-[12px]">
          <Stat label="متاح الآن" value={data.kpis.totalAvailable.toLocaleString("en-US")} tone="ok" />
          <Stat label="محجوز" value={data.kpis.reservedNow.toLocaleString("en-US")} tone="warn" />
          <Stat label="بيع اليوم" value={data.kpis.soldToday.toLocaleString("en-US")} tone="muted" />
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-border bg-card p-3 shadow-card">
        <FilterGroup label="النوع">
          {TYPES.map((t) => (
            <Chip key={t} active={type === t} onClick={() => setType(t)}>
              {t}
            </Chip>
          ))}
        </FilterGroup>
        <div className="hidden h-6 w-px bg-border lg:block" />
        <FilterGroup label="المنطقة">
          {AREAS.map((a) => (
            <Chip key={a} active={area === a} onClick={() => setArea(a)}>
              {a}
            </Chip>
          ))}
        </FilterGroup>
        <label className="ms-auto flex cursor-pointer items-center gap-2 text-[12.5px] text-muted-foreground">
          <input
            type="checkbox"
            checked={onlyAvailable}
            onChange={(e) => setOnlyAvailable(e.target.checked)}
            className="h-3.5 w-3.5 accent-primary"
          />
          المتاح فقط
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] tabular-nums">
            {filtered.length}/{availableCount}
          </span>
        </label>
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

      {/* Sources */}
      <p className="pt-1 text-center text-[11px] leading-relaxed text-muted-foreground">
        الأسعار مبنية على تقارير السوق المصري 2026 ·{" "}
        {MARKET_SOURCES.slice(0, 2).map((s, i) => (
          <span key={s.url}>
            {i > 0 && " · "}
            <a href={s.url} target="_blank" rel="noreferrer" className="underline hover:text-foreground">
              {s.label}
            </a>
          </span>
        ))}
      </p>
    </div>
  );
}

function UnitCard({ unit }: { unit: LiveUnit }) {
  const sold = unit.status === "sold";
  const reserved = unit.status === "reserved";
  return (
    <div className={cn("group overflow-hidden rounded-xl border border-border bg-card shadow-card transition-shadow hover:shadow-pop", sold && "opacity-60")}>
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

      <div className="p-3.5">
        <div className="truncate text-[14px] font-semibold">{unit.compound}</div>
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
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            {unit.delivery}
          </span>
        </div>

        <div className="mt-2 text-[11px] text-muted-foreground">
          {unit.pricePerM.toLocaleString("en-US")} ج.م / م²
        </div>

        <div className="mt-2 flex items-center justify-between">
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

function Stat({ label, value, tone }: { label: string; value: string; tone: "ok" | "warn" | "muted" }) {
  const color = tone === "ok" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : "text-foreground";
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-semibold tabular-nums", color)}>{value}</span>
    </span>
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

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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
