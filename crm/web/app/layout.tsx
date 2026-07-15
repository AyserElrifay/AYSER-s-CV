import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "عقّار CRM — نظام إدارة العملاء العقاري",
  description:
    "منصة CRM عقارية متعددة البوابات: بوابة تسويق مركزية وواجهة مبيعات بسيطة بنمط Notion.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        {/* Progressive enhancement: nicer Arabic type when the browser can reach it. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-background antialiased">{children}</body>
    </html>
  );
}
