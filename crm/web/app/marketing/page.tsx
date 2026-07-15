import Link from "next/link";
import {
  Building2,
  Users,
  Send,
  Gauge,
  Trophy,
  Wallet,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatTile } from "@/components/stat-tile";
import { MarketPulse } from "@/components/market-pulse";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { companies, kpis, leadSources } from "@/lib/mock-data";

export default function MarketingDashboard() {
  return (
    <AppShell
      portal="marketing"
      title="لوحة التحكم"
      subtitle="نظرة شاملة على أداء كل الشركات"
      actions={
        <Button asChild size="sm">
          <Link href="/marketing/assistant">
            <Sparkles className="h-4 w-4" />
            رفع ليدز جديدة
          </Link>
        </Button>
      }
    >
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile icon={Building2} label="الشركات النشطة" value={String(kpis.totalCompanies)} hint="من أصل 120 مقعد" />
        <StatTile icon={Users} label="إجمالي الليدز" value={kpis.totalLeads.toLocaleString("ar-EG")} hint="+٣٪ هذا الأسبوع" tone="up" />
        <StatTile icon={Send} label="وُزّعت اليوم" value={String(kpis.distributedToday)} hint="على ٤٨ موظفاً" />
        <StatTile icon={Gauge} label="متوسط الجودة" value={`${kpis.avgQuality}`} hint="مؤشر الليدز" />
        <StatTile icon={Trophy} label="صفقات الشهر" value={String(kpis.closedThisMonth)} hint="+١٢ عن الشهر الماضي" tone="up" />
        <StatTile icon={Wallet} label="إيراد الشهر" value={`${(kpis.revenueThisMonth / 1_000_000).toFixed(1)} م ج.م`} hint="قيمة الصفقات" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Companies overview */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-[15px]">أداء الشركات</CardTitle>
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
              <Link href="/marketing/companies">
                عرض الكل
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-subtle/60 text-[12px] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-start font-medium">الشركة</th>
                    <th className="px-4 py-2.5 text-start font-medium">النوع</th>
                    <th className="px-4 py-2.5 text-center font-medium">الليدز</th>
                    <th className="px-4 py-2.5 text-center font-medium">الفريق</th>
                    <th className="px-4 py-2.5 text-center font-medium">التحويل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {companies.map((c) => (
                    <tr key={c.id} className="transition-colors hover:bg-subtle/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-bold text-white"
                            style={{ backgroundColor: c.color }}
                          >
                            {c.logo}
                          </span>
                          <span className="font-medium">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">
                          {c.type === "developer" ? "مطوّر" : "وسيط"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums">{c.leads}</td>
                      <td className="px-4 py-3 text-center tabular-nums">{c.agents}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-medium tabular-nums text-emerald-600">{c.conversion}٪</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Lead sources */}
        <Card>
          <CardHeader>
            <CardTitle className="text-[15px]">مصادر الليدز</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3.5">
            {leadSources.map((s) => (
              <div key={s.name}>
                <div className="mb-1 flex items-center justify-between text-[13px]">
                  <span className="text-muted-foreground">{s.name}</span>
                  <span className="font-medium tabular-nums">{s.value}٪</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary/80"
                    style={{ width: `${s.value}%` }}
                  />
                </div>
              </div>
            ))}
            <div className="rounded-lg bg-subtle/70 p-3 text-[12px] leading-relaxed text-muted-foreground">
              فيسبوك يقود المصادر — يُنصح بزيادة ميزانية حملات التجمع الخامس ذات جودة الليدز الأعلى.
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live, real-market data — self-updating */}
      <div className="mt-6">
        <MarketPulse />
      </div>
    </AppShell>
  );
}
