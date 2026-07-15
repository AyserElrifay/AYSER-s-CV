"use client";

import { TrendingUp, TrendingDown, Flame, ArrowUpRight } from "lucide-react";
import { cn, egp } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LiveBadge } from "@/components/live-badge";
import { useLiveMarket } from "@/lib/use-live-market";

export function MarketPulse() {
  const { data } = useLiveMarket(15000);
  const maxShare = Math.max(...data.bestSellers.map((b) => b.share));

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-[15px] font-semibold">نبض السوق العقاري</h2>
        <Badge variant="outline" className="text-[11px]">بيانات حقيقية · 2026</Badge>
        <LiveBadge updatedAt={data.updatedAt} className="ms-auto" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Best sellers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-[14px]">الأكثر مبيعاً — حسب حصة الطلب</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 pt-0">
            {data.bestSellers.map((b) => (
              <div key={b.type} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-[13px] font-medium">{b.type}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary/80 transition-all duration-700"
                    style={{ width: `${(b.share / maxShare) * 100}%` }}
                  />
                </div>
                <span className="w-9 shrink-0 text-end text-[12px] font-semibold tabular-nums">{b.share}٪</span>
                <span className="hidden w-28 shrink-0 text-end text-[11px] text-muted-foreground sm:block">
                  ~{b.avgPricePerM.toLocaleString("en-US")} ج/م²
                </span>
                <span className="w-16 shrink-0 text-end text-[11px] text-emerald-600 tabular-nums">
                  {b.availableNow} متاح
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Live price ticker per area */}
        <Card>
          <CardHeader>
            <CardTitle className="text-[14px]">سعر المتر — تحرّك مباشر</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 pt-0">
            {data.ticker.map((t) => {
              const up = t.changePct >= 0;
              return (
                <div key={t.area} className="rounded-lg border border-border bg-subtle/40 p-2.5">
                  <div className="flex items-center gap-1 text-[12px] text-muted-foreground">
                    {t.hot && <Flame className="h-3 w-3 text-orange-500" />}
                    <span className="truncate">{t.area}</span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-[15px] font-semibold tabular-nums">
                      {t.pricePerM.toLocaleString("en-US")}
                    </span>
                    <span className={cn("flex items-center gap-0.5 text-[11px] font-medium tabular-nums", up ? "text-emerald-600" : "text-rose-500")}>
                      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {up ? "+" : ""}{t.changePct}٪
                    </span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Availability by area */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-[14px]">الإتاحة حسب المنطقة</CardTitle>
          <span className="text-[11px] text-muted-foreground">
            أهم منطقة صاعدة: <b className="text-foreground">{data.kpis.hottestArea}</b>
          </span>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {data.availabilityByArea.map((a) => {
            const pct = (n: number) => `${(n / a.total) * 100}%`;
            return (
              <div key={a.area}>
                <div className="mb-1 flex items-center justify-between text-[12px]">
                  <span className="font-medium">{a.area}</span>
                  <span className="text-muted-foreground tabular-nums">
                    <span className="text-emerald-600">{a.available}</span> متاح ·{" "}
                    <span className="text-amber-600">{a.reserved}</span> محجوز ·{" "}
                    {a.sold} مباع
                  </span>
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full bg-emerald-500/80 transition-all duration-700" style={{ width: pct(a.available) }} />
                  <div className="h-full bg-amber-400/80 transition-all duration-700" style={{ width: pct(a.reserved) }} />
                  <div className="h-full bg-muted-foreground/30 transition-all duration-700" style={{ width: pct(a.sold) }} />
                </div>
              </div>
            );
          })}
          <a
            href="/sales/supermarket"
            className="inline-flex items-center gap-1 pt-1 text-[12px] font-medium text-primary hover:underline"
          >
            تصفّح كل الوحدات في سوق العقارات
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </CardContent>
      </Card>
    </section>
  );
}
