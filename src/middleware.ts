/**
 * Session refresh and locale routing.
 *
 * A Server Component cannot write cookies, so the access token must be refreshed
 * here; otherwise a teacher is silently signed out mid-session.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { LOCALES, pickLocale } from "@/lib/i18n/locale";

/** The locale the visitor reads, from the path if it names one, else the header. */
function localeFor(req: NextRequest): string {
  const seg = req.nextUrl.pathname.split("/")[1];
  if ((LOCALES as readonly string[]).includes(seg)) return seg;
  return pickLocale(req.headers.get("accept-language"));
}

/**
 * Every response this middleware returns passes through here.
 *
 * The headers used to be set at the end of the happy path only, so `/` (which
 * returns early) and any deployment missing its Supabase env served pages with
 * no `X-Frame-Options`, no `nosniff` and no `Referrer-Policy`. A security header
 * that depends on which branch ran is a header you cannot rely on.
 */
function harden(res: NextResponse): NextResponse {
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-Frame-Options", "DENY");
  return res;
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  return harden(await handle(req));
}

async function handle(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // `/` is the public landing page, and it is served by `/[locale]`. The root
  // used to be a statically prerendered page whose `redirect()` was baked at
  // build time, which Next served as a 307 with NO Location header — a dead link
  // for anyone typing the bare domain. Redirecting here instead means the target
  // is computed per request and always carries a destination.
  if (pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = `/${localeFor(req)}`;
    return NextResponse.redirect(url, 307);
  }

  // The auth callback exchanges its own code and writes its own cookies. A
  // session refresh here would be a wasted round trip whose result the route
  // then discards, and it runs before the visitor has a session at all.
  if (pathname.startsWith("/auth")) return NextResponse.next();

  // Send un-prefixed application paths to the visitor's locale. The root is
  // already handled above; infrastructure paths must never be rewritten.
  const isInfrastructure =
    pathname.startsWith("/api") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/brand") ||
    pathname === "/favicon.ico" ||
    /\.(?:png|jpe?g|svg|webp|ico|txt|xml|json)$/i.test(pathname);

  if (!isInfrastructure) {
    const seg = pathname.split("/")[1];
    if (!(LOCALES as readonly string[]).includes(seg)) {
      const url = req.nextUrl.clone();
      url.pathname = `/${localeFor(req)}${pathname}`;
      return NextResponse.redirect(url);
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return NextResponse.next();

  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          req.cookies.set(name, value);
        }
        res = NextResponse.next({ request: req });
        for (const { name, value, options } of cookiesToSet) {
          res.cookies.set(name, value, options);
        }
      },
    },
  });

  // Touching getUser() is what performs the refresh.
  await supabase.auth.getUser();

  return res;
}

/**
 * `brand/` and `images/` are static asset folders under public/. Without them in
 * this exclusion the locale redirect rewrites /brand/hero-bulb.webp to
 * /ar/brand/... and every image 404s.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/|images/).*)"],
};
