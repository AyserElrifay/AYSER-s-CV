import { Check, AlertTriangle, Copy, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const MAPPING = [
  { col: "العمود A", field: "الاسم الكامل", sample: "محمد عبد الله" },
  { col: "العمود C", field: "رقم الهاتف", sample: "+2010xxxxxxx" },
  { col: "العمود D", field: "الميزانية", sample: "٣ – ٤ مليون" },
  { col: "العمود F", field: "المنطقة المهتم بها", sample: "التجمع الخامس" },
];

export function ImportPreviewCard({
  onConfirm,
  confirmed,
}: {
  onConfirm: () => void;
  confirmed: boolean;
}) {
  return (
    <div className="mt-1 w-full max-w-xl overflow-hidden rounded-xl border border-border bg-card shadow-card">
      {/* Target company banner — the safety anchor: no doubt about destination */}
      <div className="flex items-center gap-2.5 border-b border-border bg-subtle/70 px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2E7CF6] text-[12px] font-bold text-white">
          ن
        </span>
        <div className="leading-tight">
          <div className="text-[11px] text-muted-foreground">وجهة الاستيراد</div>
          <div className="text-sm font-semibold">شركة النور للتطوير العقاري</div>
        </div>
        <span className="ms-auto rounded-full bg-blue-50 px-2.5 py-0.5 text-[12px] font-medium text-blue-700">
          حملة فيسبوك
        </span>
      </div>

      {/* Column mapping */}
      <div className="px-4 py-3">
        <div className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
          <ArrowLeftRight className="h-3.5 w-3.5" />
          تعيين الأعمدة (استنتجه المساعد تلقائياً)
        </div>
        <div className="space-y-1.5">
          {MAPPING.map((m) => (
            <div
              key={m.col}
              className="flex items-center gap-2 rounded-lg bg-subtle/60 px-3 py-2 text-[13px]"
            >
              <span className="text-muted-foreground">{m.col}</span>
              <ArrowLeftRight className="h-3 w-3 text-muted-foreground/60" />
              <span className="font-medium">{m.field}</span>
              <span className="ms-auto truncate text-[12px] text-muted-foreground">{m.sample}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-px border-t border-border bg-border text-center">
        <Stat value="٢٥٣" label="إجمالي الصفوف" tone="muted" />
        <Stat value="١٤" label="أرقام مكررة" tone="warn" icon={<Copy className="h-3 w-3" />} />
        <Stat value="٣" label="غير صالحة" tone="warn" icon={<AlertTriangle className="h-3 w-3" />} />
      </div>

      {/* Action */}
      <div className="flex items-center gap-2 border-t border-border px-4 py-3">
        {confirmed ? (
          <div className="flex items-center gap-1.5 text-[13px] font-medium text-emerald-600">
            <Check className="h-4 w-4" />
            تم تأكيد الاستيراد
          </div>
        ) : (
          <>
            <Button size="sm" onClick={onConfirm}>
              <Check className="h-4 w-4" />
              تأكيد الاستيراد · ٢٣٦ ليد صالح
            </Button>
            <Button size="sm" variant="ghost" className="text-muted-foreground">
              تعديل التعيين
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({
  value,
  label,
  tone,
  icon,
}: {
  value: string;
  label: string;
  tone: "muted" | "warn";
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-card py-3">
      <div
        className={`flex items-center justify-center gap-1 text-lg font-semibold tabular-nums ${
          tone === "warn" ? "text-amber-600" : "text-foreground"
        }`}
      >
        {icon}
        {value}
      </div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
