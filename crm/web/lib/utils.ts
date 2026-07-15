import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Compact Arabic currency (EGP) — e.g. 3,500,000 → "٣٫٥ م ج.م" style, kept ASCII for clarity. */
export function egp(value: number): string {
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return `${m % 1 === 0 ? m : m.toFixed(1)} مليون ج.م`;
  }
  if (value >= 1000) return `${(value / 1000).toFixed(0)} ألف ج.م`;
  return `${value} ج.م`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}
