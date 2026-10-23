/**
 * Trust strip — each claim is admin-managed and hidden when unverified (§7.4).
 * Currently all disabled (no verified claims yet), so strip renders empty.
 * Controlled via site_settings.trust_claims in DB.
 */
const claims: string[] = [];

export function TrustStrip() {
  if (claims.length === 0) return null;
  return (
    <section className="border-b border-neutral-200 bg-white">
      <div className="container-content flex flex-wrap items-center justify-center gap-x-8 gap-y-2 py-4 text-sm text-neutral-600">
        {claims.map((c, i) => (
          <span key={i}>{c}</span>
        ))}
      </div>
    </section>
  );
}
