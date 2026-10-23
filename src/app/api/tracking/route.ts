import { NextResponse } from "next/server";
import { q } from "@/data-access/db.mjs";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const reference = (url.searchParams.get("ref") ?? "").toUpperCase();
  const phone4 = url.searchParams.get("phone") ?? "";
  if (!reference || !phone4) {
    return NextResponse.json({ error: "Missing ref or phone" }, { status: 400 });
  }
  const row = (await q(
    `SELECT b.state, s.name_ar, b.preferred_date, b.preferred_slot
       FROM bookings b JOIN services s ON s.id = b.service_id
      WHERE b.reference = $1 AND RIGHT(b.customer_phone, 4) = $2`,
    [reference, phone4]
  )).rows[0];
  if (!row) return NextResponse.json({ found: false });
  return NextResponse.json({
    found: true,
    reference,
    state: row.state,
    service: row.name_ar,
    date: row.preferred_date,
    slot: row.preferred_slot,
  });
}
