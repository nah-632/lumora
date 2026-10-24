import { z } from "zod";

/**
 * Validation for every student-tracking input, and for the model's output.
 * AI output is validated with the same rigour as user input: an LLM response is
 * untrusted data, not a trusted internal value.
 */

const trimmed = (max: number) => z.string().trim().min(1).max(max);

export const gradeLevelSchema = trimmed(40);
export const classLabelSchema = z.string().trim().max(40).optional().or(z.literal(""));

export const studentCreateSchema = z.object({
  name: trimmed(120),
  gradeLevel: gradeLevelSchema,
  classLabel: classLabelSchema.optional(),
});

export const studentUpdateSchema = studentCreateSchema.extend({
  id: z.string().uuid(),
});

export const studentIdSchema = z.object({ id: z.string().uuid() });

export const gradeCreateSchema = z
  .object({
    studentId: z.string().uuid(),
    subject: trimmed(80),
    assessmentName: trimmed(160),
    score: z.coerce.number().min(0).max(100000),
    maxScore: z.coerce.number().gt(0).max(100000),
    date: z.coerce.date(),
  })
  .refine((v) => v.score <= v.maxScore, {
    message: "score_exceeds_max",
    path: ["score"],
  });

export const submissionStatusSchema = z.enum(["submitted", "late", "missing"]);

export const submissionCreateSchema = z.object({
  studentId: z.string().uuid(),
  projectName: trimmed(160),
  status: submissionStatusSchema,
  feedback: z.string().trim().max(2000).optional().or(z.literal("")),
  date: z.coerce.date(),
});

export const alertTypeSchema = z.enum([
  "grade_drop",
  "missing_work",
  "positive_trend",
  "follow_up",
]);

export const alertSeveritySchema = z.enum(["info", "attention", "urgent"]);

export const interventionCreateSchema = z.object({
  studentId: z.string().uuid(),
  action: z.string().trim().min(3).max(1000),
  subject: z.string().trim().max(80).optional(),
  alertId: z.string().uuid().optional(),
});

/** Marks an alert as read / snoozed / dismissed with a reason. */
export const alertActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("mark_read"), alertId: z.string().uuid() }),
  z.object({
    action: z.literal("snooze"),
    alertId: z.string().uuid(),
    until: z.coerce.date(),
  }),
  z.object({
    action: z.literal("dismiss"),
    alertId: z.string().uuid(),
    reason: z.string().trim().min(3).max(500),
  }),
]);

// ---------------------------------------------------------------------------
// AI output validation
// ---------------------------------------------------------------------------

/** A ref emitted by the model: s1, s2, ... Unknown refs are dropped by the caller. */
export const opaqueRefSchema = z.string().regex(/^s\d{1,4}$/, "bad_ref");

export const alertModelItemSchema = z.object({
  ref: opaqueRefSchema,
  alertType: alertTypeSchema,
  severity: alertSeveritySchema,
  message: z.string().trim().min(1).max(280),
  suggestedAction: z.string().trim().max(280).nullable().optional(),
  evidence: z.string().trim().max(500).nullable().optional(),
});

export const alertsModelOutputSchema = z.object({
  alerts: z.array(alertModelItemSchema).max(200),
});

export type AlertsModelOutput = z.infer<typeof alertsModelOutputSchema>;
export type AlertModelItem = z.infer<typeof alertModelItemSchema>;

// ---------------------------------------------------------------------------
// Typed error codes returned by server actions (mapped to bilingual messages)
// ---------------------------------------------------------------------------
export const errorCodeSchema = z.enum([
  "unauthorized",
  "invalid_input",
  "ai_not_configured",
  "quota_exceeded",
  "ai_output_invalid",
  "failed",
]);

export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const ERROR_MESSAGES: Record<ErrorCode, { ar: string; en: string }> = {
  unauthorized: {
    ar: "انتهت الجلسة أو لا تملك صلاحية لهذا الإجراء.",
    en: "Your session ended or you do not have permission for this action.",
  },
  invalid_input: {
    ar: "البيانات المدخلة غير صحيحة. تحقق من الحقول وحاول مرة أخرى.",
    en: "The submitted data is not valid. Check the fields and try again.",
  },
  ai_not_configured: {
    ar: "خدمة الذكاء الاصطناعي غير مهيّأة بعد. أضف مفتاح المزوّد لتفعيل التحليل.",
    en: "The AI service is not configured yet. Add a provider key to enable analysis.",
  },
  quota_exceeded: {
    ar: "استهلكت حصتك من التحليلات لهذه الفترة.",
    en: "You have used your analysis quota for this period.",
  },
  ai_output_invalid: {
    ar: "تعذّر التحقق من مخرجات التحليل. لم يتم حفظ أي شيء.",
    en: "The analysis output could not be validated. Nothing was saved.",
  },
  failed: {
    ar: "حدث خطأ غير متوقع. حاول مرة أخرى.",
    en: "Something went wrong. Please try again.",
  },
};

export function errorMessage(code: ErrorCode, locale: "ar" | "en"): string {
  return ERROR_MESSAGES[code][locale];
}

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: ErrorCode };
