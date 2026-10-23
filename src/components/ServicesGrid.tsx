const CATEGORIES = [
  { id: "ac",        ar: "التكييف والتبريد",  icon: "❄" },
  { id: "plumbing",  ar: "السباكة",            icon: "🔧" },
  { id: "electrical",ar: "الكهرباء",            icon: "⚡" },
  { id: "cleaning",  ar: "تنظيف المنازل",       icon: "🧹" },
  { id: "pest",      ar: "مكافحة الحشرات",     icon: "🛡" },
  { id: "carpentry", ar: "الألمنية والنجارة",   icon: "🪚" },
  { id: "painting",  ar: "الدهان والتشطيب",     icon: "🎨" },
  { id: "moving",    ar: "النقل والتركيب",      icon: "📦" },
  { id: "special",   ar: "خدمات متخصصة",          icon: "🔋" },
];

export function ServicesGrid() {
  return (
    <section id="services" className="py-16">
      <div className="container-content">
        <h2 className="mb-8 text-2xl font-bold text-navy">خدماتنا</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                const url = `/booking?category=${c.id}`;
                window.location.href = url;
              }}
              className="card group flex flex-col items-start gap-2 p-5 text-start transition-shadow hover:shadow-lg"
            >
              <span className="text-2xl" aria-hidden>{c.icon}</span>
              <span className="font-semibold text-navy group-hover:text-teal">{c.ar}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
