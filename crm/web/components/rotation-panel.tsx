"use client";

import { useState } from "react";
import { Shuffle, Clock, Users, Sparkles, Check, Info } from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { agents } from "@/lib/mock-data";

type Mode = "round_robin" | "weighted" | "ai_recommended";

const MODES: { id: Mode; label: string; desc: string }[] = [
  { id: "round_robin", label: "بالتساوي", desc: "توزيع عادل بالدور على كل الفريق" },
  { id: "weighted", label: "حسب الأداء", desc: "الليدز الأعلى جودة لأصحاب الأداء الأعلى" },
  { id: "ai_recommended", label: "توصية الذكاء الاصطناعي", desc: "المساعد يرشّح الأنسب لكل ليد ويشرح السبب" },
];

// AI recommendation preview (only shown in ai_recommended mode)
const AI_RECS = [
  { agent: "عمر خالد", leads: 9, reason: "أعلى معدل إغلاق لليدز الساحل (٢٢٪ مقابل ٩٪ متوسط)" },
  { agent: "كريم منصور", leads: 8, reason: "سرعة رد ممتازة داخل الـ SLA ومطابقة لمنطقة التجمع" },
  { agent: "سارة أحمد", leads: 6, reason: "حِمل حالي منخفض — مساحة لاستقبال ليدز جديدة" },
  { agent: "هالة سمير", leads: 4, reason: "قيد رفع الأداء — ليدز متوسطة الجودة للتدريب" },
];

export function RotationPanel() {
  const [mode, setMode] = useState<Mode>("ai_recommended");
  const [perAgent, setPerAgent] = useState(8);
  const [duration, setDuration] = useState(30);
  const [done, setDone] = useState(false);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      {/* Controls */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[15px]">
              <Shuffle className="h-4 w-4 text-primary" />
              نمط التوزيع
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-3">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={cn(
                  "rounded-lg border p-3 text-start transition-colors",
                  mode === m.id
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                    : "border-border bg-card hover:bg-subtle/50"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium">{m.label}</span>
                  {mode === m.id && <Check className="h-4 w-4 text-primary" />}
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{m.desc}</p>
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <Users className="h-4 w-4" />
                العدد لكل موظف
              </div>
              <div className="mt-3 flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={perAgent}
                  onChange={(e) => setPerAgent(Number(e.target.value))}
                  className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
                />
                <span className="w-10 text-center text-lg font-semibold tabular-nums">{perAgent}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <Clock className="h-4 w-4" />
                مدة الاستجابة (SLA)
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {[15, 30, 60, 120].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-[13px] transition-colors",
                      duration === d
                        ? "border-primary bg-primary/5 font-medium text-primary"
                        : "border-border text-muted-foreground hover:bg-subtle/50"
                    )}
                  >
                    {d} دقيقة
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* AI recommendation table */}
        {mode === "ai_recommended" && (
          <Card className="animate-fade-in border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[15px]">
                <Sparkles className="h-4 w-4 text-primary" />
                توصية الذكاء الاصطناعي
                <Badge variant="info" className="ms-1">قابلة للتعديل</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {AI_RECS.map((r) => (
                <div key={r.agent} className="flex items-start gap-3 rounded-lg bg-subtle/60 p-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{initials(r.agent)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium">{r.agent}</span>
                      <Badge variant="outline" className="text-[11px]">{r.leads} ليد</Badge>
                    </div>
                    <p className="mt-0.5 flex items-start gap-1 text-[12px] leading-relaxed text-muted-foreground">
                      <Info className="mt-0.5 h-3 w-3 shrink-0" />
                      {r.reason}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Summary / action */}
      <div className="space-y-4">
        <Card className="lg:sticky lg:top-24">
          <CardHeader>
            <CardTitle className="text-[15px]">ملخص التوزيع</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0 text-[13px]">
            <Row label="الشركة" value="شركة النور" />
            <Row label="ليدز جاهزة" value="٢٣٦ ليد" />
            <Row label="النمط" value={MODES.find((m) => m.id === mode)!.label} />
            <Row label="لكل موظف" value={`${perAgent} ليد`} />
            <Row label="مدة الـ SLA" value={`${duration} دقيقة`} />
            <Row label="عدد الموظفين" value={`${agents.length} نشطين`} />

            <div className="!mt-4 border-t border-border pt-4">
              {done ? (
                <div className="flex items-center justify-center gap-2 rounded-lg bg-emerald-50 py-2.5 text-[13px] font-medium text-emerald-700">
                  <Check className="h-4 w-4" />
                  تم بدء التوزيع — وصلت الإشعارات للفريق
                </div>
              ) : (
                <Button className="w-full" onClick={() => setDone(true)}>
                  <Shuffle className="h-4 w-4" />
                  بدء التوزيع الآن
                </Button>
              )}
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                الليد المُهمَل بعد {duration} دقيقة يُعاد توزيعه تلقائياً
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
