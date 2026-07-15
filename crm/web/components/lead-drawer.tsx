"use client";

import { Phone, MessageCircle, Sparkles, MapPin, Tag, Gauge, Store, StickyNote } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { egp, initials } from "@/lib/utils";
import { agents, type Lead } from "@/lib/mock-data";

export function LeadDrawer({
  lead,
  onOpenChange,
}: {
  lead: Lead | null;
  onOpenChange: (open: boolean) => void;
}) {
  const agent = lead ? agents.find((a) => a.id === lead.agentId) : null;

  return (
    <Dialog open={!!lead} onOpenChange={onOpenChange}>
      <DialogContent side="drawer" className="flex flex-col p-0">
        {lead && (
          <>
            {/* Header */}
            <div className="border-b border-border p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-sm font-medium">
                  {initials(lead.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <DialogTitle className="text-base">{lead.name}</DialogTitle>
                  <div className="mt-0.5 flex items-center gap-1 text-[12px] text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {lead.area}
                  </div>
                </div>
                <Badge variant={lead.quality >= 80 ? "success" : "warning"}>
                  جودة {lead.quality}
                </Badge>
              </div>

              {/* Quick actions */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button size="sm">
                  <Phone className="h-4 w-4" />
                  اتصال
                </Button>
                <Button size="sm" variant="soft">
                  <MessageCircle className="h-4 w-4" />
                  واتساب
                </Button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {/* AI tip */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <div className="flex items-center gap-1.5 text-[12px] font-medium text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  توصية المساعد
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-foreground/80">
                  {lead.aiTip ?? "طابق هذا الليد مع وحدة مناسبة من سوق العقارات لبدء العرض."}
                </p>
              </div>

              <div className="space-y-2.5">
                <Field icon={<Tag className="h-4 w-4" />} label="المصدر / الحملة" value={`${lead.source} · ${lead.campaign}`} />
                <Field icon={<Gauge className="h-4 w-4" />} label="الميزانية" value={`${egp(lead.budgetMin)} – ${egp(lead.budgetMax)}`} />
                <Field icon={<Phone className="h-4 w-4" />} label="الهاتف" value={lead.phone} dir="ltr" />
                <Field
                  icon={<span className="flex h-4 w-4 items-center justify-center text-[10px]">{initials(agent?.name ?? "")}</span>}
                  label="مسؤول المتابعة"
                  value={agent?.name ?? "—"}
                />
              </div>

              <Separator />

              {/* Match a unit */}
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-[13px] font-medium">
                  <Store className="h-4 w-4 text-muted-foreground" />
                  وحدات مقترحة
                </div>
                <Button variant="outline" size="sm" className="w-full justify-center">
                  فتح سوق العقارات وفلترة حسب ميزانية العميل
                </Button>
              </div>

              {/* Note */}
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-[13px] font-medium">
                  <StickyNote className="h-4 w-4 text-muted-foreground" />
                  ملاحظة
                </div>
                <textarea
                  rows={3}
                  placeholder="اكتب ملخص المكالمة…"
                  className="w-full resize-none rounded-lg border border-input bg-card p-3 text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  icon,
  label,
  value,
  dir,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  dir?: "ltr" | "rtl";
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-subtle text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className="truncate text-[13px] font-medium" dir={dir}>{value}</div>
      </div>
    </div>
  );
}
