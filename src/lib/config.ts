/**
 * SERVO: config validated at boot (§3 — fail fast).
 * Feature flags default to false (§2: unverified = off).
 */
export interface FeatureFlags {
  payments: boolean;
  whatsapp: boolean;
  reviews: boolean;
  blog: boolean;
  promotions: boolean;
  providerAccounts: boolean;
}

function flag(name: string): boolean {
  return process.env[`FEATURE_${name.toUpperCase()}`] === "true";
}

export function getFeatureFlags(): FeatureFlags {
  return {
    payments: flag("payments"),
    whatsapp: flag("whatsapp"),
    reviews: flag("reviews"),
    blog: flag("blog"),
    promotions: flag("promotions"),
    providerAccounts: flag("providerAccounts".toUpperCase()),
  };
}

export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`[boot] Missing required env var: ${key}`);
  return value;
}
