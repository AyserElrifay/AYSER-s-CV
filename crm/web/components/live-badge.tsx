"use client";

import { useEffect, useState } from "react";
import { timeAgo } from "@/lib/use-live-market";
import { cn } from "@/lib/utils";

// Pulsing "live" chip that shows how long ago the data last refreshed.
// Ticks its own clock every second so the label counts up between polls.
export function LiveBadge({ updatedAt, className }: { updatedAt: number; className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700",
        className
      )}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      مباشر · {timeAgo(updatedAt, now)}
    </span>
  );
}
