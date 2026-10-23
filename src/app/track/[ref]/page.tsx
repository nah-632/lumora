"use client";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

const STATE_AR: Record<string, string> = {
  pending_confirmation: "بانتظار التأكيد",
  confirmed: "مؤكد",
  assigned: "تم إسناد الفني",
  technician_en_route: "الفني في الطريق",
  in_progress: "جاري التنفيذ",
  completed: "مكتمل ✓",
  cancelled: "ملغي",
  rejected: "مرفوض",
};

function TrackView() {
  const params = useParams();
  const search = useSearchParams();
  const ref = String(params.ref ?? "").toUpperCase();
  const phone4 = search.get("phone") ?? "";

  const [data, setData] = useState<{ found: boolean; state?: string; service?: string; date?: string; slot?: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ref || !phone4) return;
    fetch(`/api/tracking?ref=${encodeURIComponent(ref)}&phone=${phone4}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setError("تعذر جلب حالة الطلب"));
  }, [ref, phone4]);

  if (!phone4) {
    return (
      <div className="container-content py-16">
        <div className="card mx-auto max-w-md p-6 text-center">
          <h1 className="text-lg font-bold text-navy">تتبع الطلب</h1>
          <p className="mt-2 text-sm text-neutral-600">أدخل آخر 4 أرقام من رقم هاتفك للمتابعة</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const p = f.get("p4") as string;
              window.location.href = `/track/${ref}?phone=${p}`;
            }}
            className="mt-4 space-y-3"
          >
            <input
              name="p4"
              placeholder="1234"
              inputMode="numeric"
              maxLength={4}
              dir="ltr"
              className="input-field text-center"
            />
            <button className="btn-primary w-full">متابعة</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container-content py-16">
      <div className="card mx-auto max-w-md p-6">
        <p className="text-center font-mono text-sm text-neutral-500" dir="ltr">{ref}</p>

        {error && <p className="mt-4 text-center text-sm text-danger">{error}</p>}

        {data?.found && (
          <div className="mt-4 space-y-3">
            <div className="rounded-lg bg-sand-gold/15 p-4 text-center">
              <span className="text-2xl font-bold text-navy">{STATE_AR[data.state ?? ""] ?? data.state}</span>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-neutral-500">الخدمة</dt>
                <dd className="font-medium text-charcoal">{data.service}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">التاريخ</dt>
                <dd className="font-medium text-charcoal" dir="ltr">{data.date}</dd>
              </div>
            </dl>
            <p className="text-xs text-neutral-500">
              يُعرض هنا الحالة والخدمة فقط — لحماية خصوصية العنوان والاسم.
            </p>
          </div>
        )}

        {data && !data.found && !error && (
          <p className="mt-4 text-center text-sm text-neutral-600">لم يُعثر على طلب مطابق.</p>
        )}

        {!data && !error && <p className="mt-4 text-center text-sm text-neutral-500">جارٍ التحميل...</p>}
      </div>
    </div>
  );
}

export default function TrackPage() {
  return (
    <Suspense fallback={<div className="container-content py-16 text-center">جارٍ التحميل...</div>}>
      <TrackView />
    </Suspense>
  );
}
