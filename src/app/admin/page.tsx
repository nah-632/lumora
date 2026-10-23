"use client";
import { useEffect, useState } from "react";

type BookingRow = {
  id: string;
  reference: string;
  state: string;
  contact_name: string;
  contact_phone: string;
  preferred_date: string;
  created_at: string;
  service_name: string;
};

const STATE_AR: Record<string, string> = {
  pending_confirmation: "بانتظار التأكيد",
  confirmed: "مؤكد",
  assigned: "مُسند",
  technician_en_route: "في الطريق",
  in_progress: "جاري التنفيذ",
  completed: "مكتمل",
  cancelled: "ملغي",
  rejected: "مرفوض",
};

export default function AdminPage() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/bookings${filter !== "all" ? `?state=${filter}` : ""}`);
      const data = await res.json();
      setBookings(data.bookings ?? []);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filter]);

  const transition = async (id: string, to: string, actor: string) => {
    await fetch("/api/admin/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, to, actor }),
    });
    load();
  };

  return (
    <div className="container-content py-10">
      <h1 className="mb-6 text-2xl font-bold text-navy">لوحة الإدارة — الحجوزات</h1>

      <div className="mb-4 flex flex-wrap gap-2">
        {["all", "pending_confirmation", "confirmed", "assigned", "completed"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 text-sm transition-colors ${
              filter === s ? "bg-teal font-semibold text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            {s === "all" ? "الكل" : STATE_AR[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-neutral-500">جارٍ التحميل...</p>
      ) : bookings.length === 0 ? (
        <div className="card p-8 text-center text-neutral-500">
          لا توجد حجوزات{filter !== "all" ? ` بالحالة «${STATE_AR[filter] ?? filter}»` : ""} حالياً.
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-start text-neutral-500">
              <tr>
                <th className="p-3 text-start">المرجع</th>
                <th className="p-3 text-start">العميل</th>
                <th className="p-3 text-start">الخدمة</th>
                <th className="p-3 text-start">التاريخ</th>
                <th className="p-3 text-start">الحالة</th>
                <th className="p-3 text-start">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-t border-neutral-100">
                  <td className="p-3 font-mono text-xs" dir="ltr">{b.reference}</td>
                  <td className="p-3">{b.contact_name}<br /><span className="text-xs text-neutral-500" dir="ltr">{b.contact_phone}</span></td>
                  <td className="p-3">{b.service_name}</td>
                  <td className="p-3" dir="ltr">{b.preferred_date}</td>
                  <td className="p-3">
                    <span className="rounded-full bg-teal/10 px-2 py-0.5 text-xs font-medium text-teal">
                      {STATE_AR[b.state] ?? b.state}
                    </span>
                  </td>
                  <td className="p-3">
                    {b.state === "pending_confirmation" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => transition(b.id, "confirmed", "admin")}
                          className="rounded bg-success/15 px-2 py-1 text-xs font-medium text-success hover:bg-success/25"
                        >
                          تأكيد
                        </button>
                        <button
                          onClick={() => transition(b.id, "rejected", "admin")}
                          className="rounded bg-danger/15 px-2 py-1 text-xs font-medium text-danger hover:bg-danger/25"
                        >
                          رفض
                        </button>
                      </div>
                    )}
                    {b.state === "confirmed" && (
                      <button
                        onClick={() => transition(b.id, "assigned", "operations")}
                        className="rounded bg-sand-gold/20 px-2 py-1 text-xs font-medium text-navy hover:bg-sand-gold/35"
                      >
                        إسناد
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
