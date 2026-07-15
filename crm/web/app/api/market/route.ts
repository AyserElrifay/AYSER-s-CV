import { NextResponse } from "next/server";
import { buildSnapshot } from "@/lib/market";

// Always compute a fresh snapshot — the data self-updates on every request.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export function GET() {
  return NextResponse.json(buildSnapshot(Date.now()), {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
