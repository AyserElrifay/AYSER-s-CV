"use client";

import { useEffect, useRef, useState } from "react";
import { buildSnapshot, type Snapshot } from "@/lib/market";

// Polls /api/market on an interval so the UI keeps refreshing itself.
// Seeds with a client-computed snapshot for instant first paint (no spinner),
// then swaps to the server feed and re-fetches every `intervalMs`.
export function useLiveMarket(intervalMs = 15000) {
  const [data, setData] = useState<Snapshot>(() => buildSnapshot(Date.now()));
  const [pulse, setPulse] = useState(0); // bumps each refresh, for animations
  const timer = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    let alive = true;

    async function tick() {
      try {
        const res = await fetch("/api/market", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const json: Snapshot = await res.json();
        if (!alive) return;
        setData(json);
        setPulse((p) => p + 1);
      } catch {
        // Network hiccup — fall back to a locally computed snapshot so the
        // clock and values still advance instead of freezing.
        if (!alive) return;
        setData(buildSnapshot(Date.now()));
        setPulse((p) => p + 1);
      }
    }

    tick();
    timer.current = setInterval(tick, intervalMs);
    return () => {
      alive = false;
      if (timer.current) clearInterval(timer.current);
    };
  }, [intervalMs]);

  return { data, pulse };
}

// "منذ Xث / Xد" relative time in Arabic.
export function timeAgo(from: number, now: number = Date.now()): string {
  const s = Math.max(0, Math.round((now - from) / 1000));
  if (s < 60) return `منذ ${s}ث`;
  const m = Math.round(s / 60);
  if (m < 60) return `منذ ${m}د`;
  const h = Math.round(m / 60);
  return `منذ ${h}س`;
}
