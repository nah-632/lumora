/**
 * LUMORA: shared Zod validation schemas (§3 — typed end to end).
 */
import { z } from "zod";
import { normalizeBahrainPhone } from "@/domain/bahrain.mjs";

export const governorateSchema = z.enum(["capital", "muharraq", "northern", "southern"]);

/** Bahrain phone: accepts common formats, normalizes to E.164 (+973XXXXXXXX) */
export const bahrainPhoneSchema = z
  .string()
  .min(8)
  .max(20)
  .transform(normalizeBahrainPhone)
  .refine((v): v is string => v !== null, {
    message: "رقم هاتف بحريني غير صالح / Invalid Bahraini phone number",
  });

export const bookingDraftSchema = z.object({
  serviceId: z.string().uuid(),
  subserviceId: z.string().uuid().optional(),
  governorate: governorateSchema,
  area: z.string().min(1).max(100),
  addressDetails: z.string().min(1).max(500),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  preferredSlot: z.string().regex(/^\d{2}:\d{2}$/),
  // dynamic service details — validated per-service at API layer
  serviceDetails: z.record(z.unknown()).default({}),
  contactName: z.string().min(2).max(100),
  contactPhone: bahrainPhoneSchema,
  notes: z.string().max(1000).optional(),
  idempotencyKey: z.string().min(16).max(64),
});

export type BookingDraft = z.infer<typeof bookingDraftSchema>;

export const bookingRefSchema = z.string().regex(/^LMR-[A-Z2-7]{8}$/);
export type BookingRef = z.infer<typeof bookingRefSchema>;
