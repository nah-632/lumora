"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = [
  { id: "ac", ar: "التكييف والتبريد" },
  { id: "plumbing", ar: "السباكة" },
  { id: "electrical", ar: "الكهرباء" },
  { id: "cleaning", ar: "تنظيف المنازل" },
  { id: "pest", ar: "مكافحة الحشرات" },
  { id: "carpentry", ar: "الألمنية والنجارة" },
  { id: "painting", ar: "الدهان والتشطيب" },
  { id: "moving", ar: "النقل والتركيب" },
  { id: "special", ar: "خدمات متخصصة" },
];

const GOVERNORATES = [
  { id: "capital", ar: "العاصمة" },
  { id: "muharraq", ar: "المحرق" },
  { id: "northern", ar: "الشمالية" },
  { id: "southern", ar: "الجنوبية" },
];

export default function BookingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    category: "", governorate: "", area: "", address: "",
    date: "", slot: "", name: "", phone: "", notes: "",
  });
  const [status, setStatus] = useState<{ ok: boolean; msg: string; ref?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const validateStep = (s: number): boolean => {
    if (s === 0) return !!form.category;
    if (s === 1) return !!form.governorate && !!form.area;
    if (s === 2) return !!form.date && !!form.slot;
    if (s === 3) return form.name.trim().length >= 2 && form.phone.replace(/\D/g, "").length >= 8;
    return true;
  };

  const next = () => { if (validateStep(step)) setStep((s) => Math.min(s + 1, 3)); };
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const submit = async () => {
    if (!validateStep(3)) return;
    setSubmitting(true);
    setStatus(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceDetails: { category: form.category },
          ...form,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل إنشاء الحجز");
      setStatus({ ok: true, msg: "تم استلام طلبك بنجاح — الحالة: بانتظار التأكيد", ref: data.reference });
      setStep(4);
    } catch (e: unknown) {
      setStatus({ ok: false, msg: e instanceof Error ? e.message : "خطأ غير متوقع" });
    } finally {
      setSubmitting(false);
    }
  };

  const input = "input-field";
  const label = "mb-1.5 block text-sm font-medium text-neutral-700";

  return (
    <div className="container-content py-10">
      <h1 className="mb-6 text-2xl font-bold text-navy">احجز خدمتك</h1>

      <ol className="mb-8 flex gap-2" aria-label="خطوات الحجز">
        {["الخدمة", "الموقع", "التاريخ", "التفاصيل"].map((s, i) => (
          <li key={i}>
            <div
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors ${
                i === step ? "bg-sand-gold font-semibold text-navy" :
                i < step ? "bg-teal/15 text-teal" : "bg-neutral-100 text-neutral-500"
              }`}
            >
              <span className="grid size-5 place-items-center rounded-full bg-white/60 text-xs">
                {i < step ? "✓" : i + 1}
              </span>
              <span className="hidden sm:inline">{s}</span>
            </div>
          </li>
        ))}
      </ol>

      <div className="card max-w-2xl p-6">
        {step === 0 && (
          <div>
            <label className={label}>اختر نوع الخدمة *</label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => update("category", c.id)}
                  className={`rounded-lg border p-3 text-sm transition-colors ${
                    form.category === c.id
                      ? "border-sand-gold bg-sand-gold/15 font-semibold text-navy"
                      : "border-neutral-200 hover:border-neutral-300"
                  }`}
                >
                  {c.ar}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className={label}>المحافظة *</label>
              <select className={input} value={form.governorate} onChange={(e) => update("governorate", e.target.value)}>
                <option value="">— اختر المحافظة —</option>
                {GOVERNORATES.map((g) => <option key={g.id} value={g.id}>{g.ar}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>المنطقة / الحي *</label>
              <input
                className={input} placeholder="مثال: عالي، مدينة عيسى..."
                value={form.area} onChange={(e) => update("area", e.target.value)}
              />
            </div>
            <div>
              <label className={label}>تفاصيل العنوان</label>
              <input
                className={input} placeholder="اسم الشارع، رقم الفيلا..."
                value={form.address} onChange={(e) => update("address", e.target.value)}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className={label}>التاريخ المفضل *</label>
              <input
                type="date" className={input}
                min={new Date().toISOString().slice(0, 10)}
                value={form.date} onChange={(e) => update("date", e.target.value)}
              />
            </div>
            <div>
              <label className={label}>الفترة الزمنية المفضلة *</label>
              <select className={input} value={form.slot} onChange={(e) => update("slot", e.target.value)}>
                <option value="">— اختر الفترة —</option>
                <option value="08:00">08:00 – 12:00</option>
                <option value="12:00">12:00 – 16:00</option>
                <option value="16:00">16:00 – 20:00</option>
              </select>
              <p className="mt-2 text-xs text-neutral-500">
                هذه فترة مفضلة — سيتم تأكيد الموعد الفعلي بعد مراجعة الطلب.
              </p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className={label}>الاسم الكامل *</label>
              <input
                className={input} placeholder="اسمك الكامل"
                value={form.name} onChange={(e) => update("name", e.target.value)}
              />
            </div>
            <div>
              <label className={label}>رقم الهاتف (8 أرقام) *</label>
              <input
                className={input} placeholder="12345678" inputMode="numeric" dir="ltr"
                value={form.phone} onChange={(e) => update("phone", e.target.value)}
              />
            </div>
            <div>
              <label className={label}>ملاحظات إضافية</label>
              <textarea
                className={input} rows={3} placeholder="وصف المشكلة، ملاحظات..."
                value={form.notes} onChange={(e) => update("notes", e.target.value)}
              />
            </div>
          </div>
        )}

        {step === 4 && status && (
          <div className="py-6 text-center">
            <div
              className={`mx-auto mb-4 grid size-16 place-items-center rounded-full text-3xl ${
                status.ok ? "bg-success/15" : "bg-danger/15"
              }`}
            >
              {status.ok ? "✓" : "✕"}
            </div>
            <h2 className="text-lg font-bold text-navy">{status.msg}</h2>
            {status.ref && (
              <p className="mt-2 text-sm text-neutral-600">
                رقم المرجع: <span className="font-mono font-semibold text-teal" dir="ltr">{status.ref}</span>
              </p>
            )}
            {status.ok && (
              <button
                onClick={() => router.push(`/track/${status.ref}?phone=${form.phone.replace(/\D/g, "").slice(-4)}`)}
                className="btn-primary mt-6"
              >
                تتبع الطلب
              </button>
            )}
            <button onClick={() => setStep(0)} className="btn-secondary mt-4">حجز جديد</button>
          </div>
        )}

        {status && !status.ok && step === 3 && (
          <p className="mt-3 text-sm font-medium text-danger">{status.msg}</p>
        )}

        {step < 4 && (
          <div className="mt-6 flex justify-between">
            <button
              onClick={back} disabled={step === 0}
              className="rounded-lg px-4 py-2 text-sm text-neutral-600 disabled:opacity-40"
            >
              السابق
            </button>
            {step < 3 ? (
              <button onClick={next} className="btn-primary">التالي</button>
            ) : (
              <button onClick={submit} disabled={submitting} className="btn-primary">
                {submitting ? "جارٍ الإرسال..." : "تأكيد الطلب"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
