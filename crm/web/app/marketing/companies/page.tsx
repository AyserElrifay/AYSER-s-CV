import { Plus, Users, TrendingUp, ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { companies } from "@/lib/mock-data";

export default function CompaniesPage() {
  return (
    <AppShell
      portal="marketing"
      title="الشركات"
      subtitle="كل شركة بوابة معزولة تماماً — بياناتها لا تُرى إلا لها"
      actions={
        <Button size="sm">
          <Plus className="h-4 w-4" />
          إضافة شركة
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {companies.map((c) => (
          <Card key={c.id} className="group overflow-hidden transition-shadow hover:shadow-pop">
            <div className="h-1.5" style={{ backgroundColor: c.color }} />
            <div className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-base font-bold text-white"
                    style={{ backgroundColor: c.color }}
                  >
                    {c.logo}
                  </span>
                  <div className="leading-tight">
                    <div className="font-semibold">{c.name}</div>
                    <div className="text-[12px] text-muted-foreground">crm.app/{c.slug}</div>
                  </div>
                </div>
                <Badge variant="outline">{c.type === "developer" ? "مطوّر" : "وسيط"}</Badge>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                <Stat label="ليدز" value={String(c.leads)} />
                <Stat label="فريق" value={String(c.agents)} icon={<Users className="h-3.5 w-3.5" />} />
                <Stat label="تحويل" value={`${c.conversion}٪`} icon={<TrendingUp className="h-3.5 w-3.5 text-emerald-500" />} />
              </div>

              <Button variant="soft" size="sm" className="mt-4 w-full justify-center text-muted-foreground group-hover:text-foreground">
                فتح بوابة الشركة
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}

        {/* Add-company ghost card */}
        <button className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/40 hover:bg-subtle/40 hover:text-foreground">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary">
            <Plus className="h-5 w-5" />
          </span>
          <span className="text-sm font-medium">إضافة شركة جديدة</span>
          <span className="text-[12px]">بوابة معزولة تُنشأ خلال ثوانٍ</span>
        </button>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-subtle/70 py-2.5">
      <div className="flex items-center justify-center gap-1 text-base font-semibold tabular-nums">
        {icon}
        {value}
      </div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
