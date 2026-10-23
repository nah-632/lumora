export function Hero() {
  return (
    <section
      className="relative flex min-h-[85vh] items-center overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #082D44 0%, #0E5A7A 100%)",
      }}
    >
      {/* Cinematic placeholder — replace with commissioned photography */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(ellipse at 70% 30%, rgba(212,180,131,0.25) 0%, transparent 55%)",
        }}
      />
      <div className="container-content relative z-10 py-16">
        <p className="mb-3 text-sm font-semibold tracking-widest text-sand-gold uppercase">
          Bahrain · Premium Home Services
        </p>
        <h1 className="max-w-2xl text-4xl font-bold leading-tight text-warm-white sm:text-5xl">
          خدمات منزلية متكاملة
          <span className="block text-2xl text-sand-gold sm:text-3xl">بجودة وموثوقية</span>
        </h1>
        <p className="mt-4 max-w-lg text-base leading-relaxed text-warm-white/80">
          من الصيانة والتنظيف إلى التكييف والكهرباء، كل ما يحتاجه منزلك في مكان واحد.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <a href="/booking" className="btn-primary">احجز الآن</a>
          <a href="#services" className="btn-secondary">اكتشف خدماتنا</a>
        </div>
      </div>
    </section>
  );
}
