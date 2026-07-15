"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, Paperclip, ArrowUp, FileSpreadsheet, Check, Send } from "lucide-react";
import { ImportPreviewCard } from "./import-preview-card";
import { Button } from "@/components/ui/button";

type Phase = "intro" | "preview" | "done";

const SUGGESTIONS = [
  "وزّع ليدز شركة النور على فريق مبيعاتهم، ٨ لكل موظف",
  "اعرض أداء موظفي مبيعات مارينا هذا الأسبوع",
  "أنشئ حملة ليدز جديدة لشركة أفق",
];

export function AssistantChat() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [input, setInput] = useState("");

  const startImport = () => setPhase("preview");
  const confirm = () => setPhase("done");

  return (
    <div className="mx-auto flex h-[calc(100vh-8.5rem)] max-w-3xl flex-col">
      {/* Thread */}
      <div className="flex-1 space-y-6 overflow-y-auto pb-4">
        {phase === "intro" && (
          <div className="flex flex-col items-center justify-center pt-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-xl font-semibold">كيف أساعدك اليوم؟</h2>
            <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
              اسحب ملف Excel واكتب أمراً بلغتك الطبيعية — سأفهم الأعمدة، أحدّد الشركة،
              وأعرض عليك معاينة قبل حفظ أي شيء.
            </p>
            <div className="mt-6 w-full max-w-md space-y-2">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={startImport}
                  className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-card px-3.5 py-2.5 text-start text-[13px] text-muted-foreground transition-colors hover:border-primary/30 hover:bg-subtle/50 hover:text-foreground"
                >
                  <Send className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {phase !== "intro" && (
          <>
            {/* User message with attachment */}
            <div className="flex justify-start">
              <div className="max-w-[85%] space-y-2">
                <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-card">
                  <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                  <div className="leading-tight">
                    <div className="text-[13px] font-medium">leads_facebook_march.xlsx</div>
                    <div className="text-[11px] text-muted-foreground">٢٥٣ صف · ٤ أعمدة</div>
                  </div>
                </div>
                <div className="rounded-xl rounded-tr-sm bg-primary px-4 py-2.5 text-[14px] text-primary-foreground">
                  دي ليدز حملة فيسبوك بتاعة شركة النور، وزّعها على فريق مبيعاتهم، ٨ لكل موظف.
                </div>
              </div>
            </div>

            {/* Assistant reply */}
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <p className="text-[14px] leading-relaxed">
                  تمام — قرأت الملف وحدّدت أنه لِـ <b>شركة النور</b>. استنتجت تعيين الأعمدة
                  ووجدت بعض التكرارات. راجع المعاينة، ولن أكتب أي بيانات قبل تأكيدك:
                </p>

                <ImportPreviewCard onConfirm={confirm} confirmed={phase === "done"} />

                {phase === "done" && (
                  <div className="animate-fade-in rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                    <div className="flex items-center gap-2 font-medium text-emerald-700">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      تم استيراد ٢٣٦ ليد بنجاح
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-3 text-center text-[13px]">
                      <div>
                        <div className="text-lg font-semibold tabular-nums">٦</div>
                        <div className="text-muted-foreground">موظفين</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold tabular-nums">٧٢</div>
                        <div className="text-muted-foreground">متوسط الجودة</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold tabular-nums">١٧</div>
                        <div className="text-muted-foreground">استُبعدت</div>
                      </div>
                    </div>
                    <Button asChild size="sm" variant="soft" className="mt-3">
                      <Link href="/marketing/rotation">عرض لوحة التوزيع</Link>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Composer */}
      <div className="rounded-2xl border border-border bg-card p-2 shadow-card">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={1}
          placeholder="اكتب أمراً، أو اسحب ملف Excel هنا…"
          className="max-h-32 w-full resize-none bg-transparent px-2.5 py-2 text-[14px] placeholder:text-muted-foreground focus:outline-none"
        />
        <div className="flex items-center gap-1.5 px-1">
          <button className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-subtle hover:text-foreground">
            <Paperclip className="h-[18px] w-[18px]" />
          </button>
          <span className="text-[11px] text-muted-foreground">
            المعاينة قبل الحفظ دائماً — لن تُكتب بيانات لشركة خطأ
          </span>
          <button
            onClick={startImport}
            className="ms-auto flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90"
          >
            <ArrowUp className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
