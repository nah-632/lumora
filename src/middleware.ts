/**
 * Session refresh and locale routing.
 *
 * A Server Component cannot write cookies, so the access token must be refreshed
 * here; otherwise a teacher is silently signed out mid-session.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const LOCALES = ["ar", "en"] as const;
const DEFAULT_LOCALE = "ar";

function pickLocale(req: NextRequest): string {
  const seg = req.nextUrl.pathname.split("/")[1];
  if ((LOCALES as readonly string[]).includes(seg)) return seg;
  const header = req.headers.get("accept-language") ?? "";
  return header.toLowerCase().startsWith("en") ? "en" : DEFAULT_LOCALE;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // `/` is the public landing page and roots the site in both languages; it must
  // not be redirected, or a visitor deep-linked to "/" loses the page entirely.
  if (pathname === "/") return NextResponse.next();

  // Send un-prefixed application paths to the visitor's locale. The root is
  // already handled above; infrastructure paths must never be rewritten.
  const isInfrastructure =
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/brand") ||
    pathname === "/favicon.ico" ||
    /\.(?:png|jpe?g|svg|webp|ico|txt|xml|json)$/i.test(pathname);

  if (!isInfrastructure) {
    const seg = pathname.split("/")[1];
    if (!(LOCALES as readonly string[]).includes(seg)) {
      const url = req.nextUrl.clone();
      url.pathname = `/${pickLocale(req)}${pathname}`;
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

  // Apply a baseline security header set to every response.
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-Frame-Options", "DENY");

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
