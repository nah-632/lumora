import { NextResponse } from "next/server";
import { z } from "zod";
import { q } from "@/data-access/db.mjs";
import { normalizeBahrainPhone } from "@/domain/bahrain.mjs";
import crypto from "node:crypto";

export const runtime = "nodejs";

const bodySchema = z.object({
  category: z.string().min(1),
  governorate: z.enum(["capital", "muharraq", "northern", "southern"]),
  area: z.string().min(1).max(100),
  address: z.string().max(500).optional().default(""),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot: z.string().regex(/^\d{2}:\d{2}$/),
  name: z.string().min(2).max(100),
  phone: z.string().min(8).max(20),
  notes: z.string().max(1000).optional().default(""),
  idempotencyKey: z.string().min(16).max(64),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "بيانات غير صالحة", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const d = parsed.data;

    const phone = normalizeBahrainPhone(d.phone);
    if (!phone) {
      return NextResponse.json(
        { error: "رقم هاتف بحريني غير صالح (8 أرقام)" },
        { status: 400 }
      );
    }

    const catNameAr: Record<string, string> = {
      ac: "التكييف والتبريد",
      plumbing: "السباكة",
      electrical: "الكهرباء",
      cleaning: "تنظيف المنازل",
      pest: "مكافحة الحشرات",
      carpentry: "الألمنية والنجارة",
      painting: "الدهان والتشطيب",
      moving: "النقل والتركيب",
      special: "خدمات متخصصة",
    };

    const catRow = (
      await q(
        `SELECT id FROM service_categories WHERE name_ar = $1 LIMIT 1`,
        [catNameAr[d.category] ?? d.category]
      )
    ).rows[0];
    if (!catRow) {
      return NextResponse.json({ error: "فئة الخدمة غير موجودة" }, { status: 404 });
    }

    let svcRow = (
      await q(`SELECT id FROM services WHERE category_id = $1 LIMIT 1`, [catRow.id])
    ).rows[0];
    if (!svcRow) {
      const created = await q(
        `INSERT INTO services (category_id, name_ar, name_en)
         SELECT c.id, c.name_ar, c.name_en FROM service_categories c WHERE c.id = $1
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [catRow.id]
      );
      svcRow = created.rows[0];
    }

    const reference =
      "SRV-" +
      crypto.randomBytes(5).toString("base64").replace(/[^A-Z0-9]/g, "Q").slice(0, 8);

    const serviceDetails = JSON.stringify({ category: d.category, notes: d.notes });

    const { rows } = await q(
      `INSERT INTO bookings
         (reference, service_id, governorate, area, address_details,
          preferred_date, preferred_slot, contact_name, contact_phone, customer_phone,
          idempotency_key, state, service_details)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending_confirmation',$12)
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING id, reference, state`,
      [reference, svcRow.id, d.governorate, d.area, d.address,
       d.date, d.slot, d.name, phone, phone, d.idempotencyKey, serviceDetails]
    );

    if (rows.length === 0) {
      const dup = (
        await q(`SELECT reference, state FROM bookings WHERE idempotency_key = $1`, [d.idempotencyKey])
      ).rows[0];
      return NextResponse.json({ reference: dup?.reference, state: dup?.state });
    }

    await q(
      `INSERT INTO booking_status_history (booking_id, to_state, actor_role, reason)
       VALUES ($1, 'pending_confirmation', 'customer', 'created')`,
      [rows[0].id]
    );
    await q(
      `INSERT INTO audit_logs (actor_role, action, entity, entity_id, after_val)
       VALUES ('customer', 'booking.create', 'booking', $1, $2)`,
      [rows[0].id, JSON.stringify({ reference: rows[0].reference })]
    );

    return NextResponse.json({ reference: rows[0].reference, state: "pending_confirmation" });
  } catch (e) {
    console.error("[api/bookings]", e);
    return NextResponse.json({ error: "خطأ داخلي" }, { status: 500 });
  }
}
