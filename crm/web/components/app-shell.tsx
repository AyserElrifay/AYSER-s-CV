"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Sparkles,
  Shuffle,
  KanbanSquare,
  Store,
  Search,
  Bell,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type NavItem = { href: string; label: string; icon: LucideIcon };

const MARKETING_NAV: NavItem[] = [
  { href: "/marketing", label: "لوحة التحكم", icon: LayoutDashboard },
  { href: "/marketing/companies", label: "الشركات", icon: Building2 },
  { href: "/marketing/assistant", label: "المساعد الذكي", icon: Sparkles },
  { href: "/marketing/rotation", label: "توزيع الليدز", icon: Shuffle },
];

const SALES_NAV: NavItem[] = [
  { href: "/sales", label: "خط الأنابيب", icon: KanbanSquare },
  { href: "/sales/supermarket", label: "سوق العقارات", icon: Store },
];

type Portal = "marketing" | "sales";

export function AppShell({
  portal,
  title,
  subtitle,
  actions,
  children,
}: {
  portal: Portal;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const nav = portal === "marketing" ? MARKETING_NAV : SALES_NAV;
  const user =
    portal === "marketing"
      ? { name: "مسوّق الوكالة", role: "فريق التسويق" }
      : { name: "كريم منصور", role: "موظف مبيعات · النور" };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="sticky top-0 flex h-screen w-[264px] shrink-0 flex-col border-e border-border bg-subtle/60">
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-5 pb-4 pt-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            ع
          </div>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold">عقّار</div>
            <div className="text-[11px] text-muted-foreground">CRM عقاري ذكي</div>
          </div>
        </div>

        {/* Portal switcher */}
        <div className="mx-3 mb-4 grid grid-cols-2 gap-1 rounded-lg bg-secondary p-1">
          <PortalTab href="/marketing" active={portal === "marketing"} label="التسويق" />
          <PortalTab href="/sales" active={portal === "sales"} label="المبيعات" />
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 px-3">
          <div className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {portal === "marketing" ? "بوابة التسويق" : "واجهة المبيعات"}
          </div>
          {nav.map((item) => {
            const active =
              item.href === "/marketing" || item.href === "/sales"
                ? pathname === item.href
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                  active
                    ? "bg-card font-medium text-foreground shadow-card"
                    : "text-muted-foreground hover:bg-card/70 hover:text-foreground"
                )}
              >
                <Icon className={cn("h-[18px] w-[18px]", active && "text-primary")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="m-3 flex items-center gap-2.5 rounded-lg border border-border bg-card px-2.5 py-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{initials(user.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[13px] font-medium">{user.name}</div>
            <div className="truncate text-[11px] text-muted-foreground">{user.role}</div>
          </div>
          <Settings className="h-4 w-4 text-muted-foreground" />
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-border bg-background/80 px-6 py-3.5 backdrop-blur">
          <div className="min-w-0">
            <h1 className="truncate text-[17px] font-semibold leading-tight">{title}</h1>
            {subtitle && (
              <p className="truncate text-[13px] text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className="ms-auto flex items-center gap-2">
            <div className="relative hidden md:block">
              <Search className="pointer-events-none absolute end-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                placeholder="بحث…"
                className="h-9 w-56 rounded-md border border-input bg-card pe-8 ps-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button className="relative flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground">
              <Bell className="h-[18px] w-[18px]" />
              <span className="absolute end-2 top-2 h-1.5 w-1.5 rounded-full bg-primary" />
            </button>
            {actions}
          </div>
        </header>

        <main className="flex-1 animate-fade-in px-6 py-6">{children}</main>
      </div>
    </div>
  );
}

function PortalTab({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-md py-1.5 text-center text-[13px] font-medium transition-colors",
        active ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </Link>
  );
}
