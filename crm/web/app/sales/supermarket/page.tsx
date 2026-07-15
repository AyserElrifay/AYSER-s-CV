import { AppShell } from "@/components/app-shell";
import { Supermarket } from "@/components/supermarket/supermarket";

export default function SupermarketPage() {
  return (
    <AppShell
      portal="sales"
      title="سوق العقارات"
      subtitle="مخزون المطوّرين المنشور على الشبكة — افلتر وابِع مباشرة"
    >
      <Supermarket />
    </AppShell>
  );
}
