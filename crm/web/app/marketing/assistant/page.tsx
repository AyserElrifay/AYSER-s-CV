import { AppShell } from "@/components/app-shell";
import { AssistantChat } from "@/components/assistant/chat";

export default function AssistantPage() {
  return (
    <AppShell
      portal="marketing"
      title="المساعد الذكي"
      subtitle="ارفع الشيتات ووزّعها بأوامر بلغتك الطبيعية"
    >
      <AssistantChat />
    </AppShell>
  );
}
