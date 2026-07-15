import { AppShell } from "@/components/app-shell";
import { RotationPanel } from "@/components/rotation-panel";

export default function RotationPage() {
  return (
    <AppShell
      portal="marketing"
      title="توزيع الليدز"
      subtitle="تحكّم في المدة والعدد، أو دع الذكاء الاصطناعي يرشّح الأنسب"
    >
      <RotationPanel />
    </AppShell>
  );
}
