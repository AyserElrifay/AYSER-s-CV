import { Plus, Filter } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { KanbanBoard } from "@/components/kanban/board";
import { Button } from "@/components/ui/button";

export default function SalesPipeline() {
  return (
    <AppShell
      portal="sales"
      title="خط الأنابيب"
      subtitle="اسحب البطاقة بين المراحل — بلا نماذج ولا تعقيد"
      actions={
        <>
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4" />
            فلترة
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4" />
            ليد يدوي
          </Button>
        </>
      }
    >
      <KanbanBoard />
    </AppShell>
  );
}
