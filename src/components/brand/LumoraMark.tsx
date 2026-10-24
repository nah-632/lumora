/**
 * The LUMORA mark used in headers, footers and on the public pages.
 *
 * The source artwork is a single square lockup (mark + wordmark + tagline) on a
 * white ground. Two crops are used: the full lockup (webp, for small surfaces
 * where the wordmark belongs) and the mark alone, cut out with a measured ink
 * box and a rounded-corner alpha so it sits on the paper ground without a white
 * rectangle around it.
 *
 * A plain <img> with explicit dimensions, not next/image: these are small static
 * files and the optimizer is deliberately unused (ADR-010 — remotePatterns is not
 * configured, and /_next/image is an attack surface this app does not need).
 */
import Link from "next/link";

interface Props {
  locale: "ar" | "en";
  withWordmark?: boolean;
  size?: number;
  /** Destination; when set the logo is a link. */
  href?: string;
}

export function LumoraMark({ locale, withWordmark = false, size = 32, href }: Props) {
  const image = withWordmark ? (
    <img
      src="/brand/lumora-logo@96.webp"
      alt={locale === "ar" ? "لومورا" : "Lumora"}
      width={size}
      height={size}
      className="rounded-sm"
      decoding="async"
    />
  ) : (
    <img
      src="/brand/lumora-mark-generated@96.png"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      decoding="async"
    />
  );

  return (
    <span className="inline-flex shrink-0 items-center">
      {href ? (
        <Link href={href} className="inline-flex items-center rounded-sm focus-visible:outline-offset-4">
          {image}
        </Link>
      ) : (
        image
      )}
    </span>
  );
}
