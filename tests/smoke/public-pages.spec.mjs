import { test, expect } from "@playwright/test";

/**
 * The public pages that must never break, and the two document properties that
 * a server-rendered check cannot see but a browser can.
 *
 * Each route is listed once with the language and direction it must declare.
 * Anything added to the public site belongs here.
 */
const ROUTES = [
  { path: "/ar", lang: "ar", dir: "rtl" },
  { path: "/en", lang: "en", dir: "ltr" },
  { path: "/ar/privacy", lang: "ar", dir: "rtl" },
  { path: "/en/privacy", lang: "en", dir: "ltr" },
  { path: "/ar/about", lang: "ar", dir: "rtl" },
  { path: "/en/about", lang: "en", dir: "ltr" },
  { path: "/ar/terms", lang: "ar", dir: "rtl" },
  { path: "/ar/sign-in", lang: "ar", dir: "rtl" },
  { path: "/en/sign-in", lang: "en", dir: "ltr" },
];

for (const route of ROUTES) {
  test.describe(route.path, () => {
    test("returns 200 and declares the right language and direction", async ({ page }) => {
      // Console errors are collected from the first paint, so a hydration error
      // is caught rather than thrown away before the listener exists.
      const consoleErrors = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });
      const pageErrors = [];
      page.on("pageerror", (err) => pageErrors.push(err.message));

      const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });

      // 1. The route answers. A 500 here is what next-intl being unwired looked
      //    like: the HTTP status is the cheapest possible alarm.
      expect(response, `no response for ${route.path}`).not.toBeNull();
      expect(response.status(), `${route.path} did not return 200`).toBe(200);

      // 2. The document declares the language it is written in. English inside
      //    <html lang="ar" dir="rtl"> is read out as Arabic and lays out every
      //    logical CSS property against the wrong edge.
      const { lang, dir } = await page.evaluate(() => ({
        lang: document.documentElement.lang,
        dir: document.documentElement.dir,
      }));
      expect(lang, `${route.path} declared lang`).toBe(route.lang);
      expect(dir, `${route.path} declared dir`).toBe(route.dir);

      // 3. Nothing threw. Assertions 1 and 2 can both pass on a page whose
      //    client code failed, so this is a separate signal.
      expect(consoleErrors, `console errors on ${route.path}`).toEqual([]);
      expect(pageErrors, `uncaught exceptions on ${route.path}`).toEqual([]);
    });
  });
}

/**
 * The reveal must be able to undo itself.
 *
 * The failure this guards against is invisible to a screenshot of the top of the
 * page: the hero renders, and everything below it stays at `opacity: 0`. So the
 * check scrolls the whole document and waits for every revealable element to
 * reach opacity 1.
 *
 * Run once with motion allowed and once with reduced motion, because the effect
 * takes a different branch for each and the reduced-motion branch is the one
 * that must never hide anything.
 */
for (const motion of ["no-preference", "reduce"]) {
  test.describe(`reveal (prefers-reduced-motion: ${motion})`, () => {
    test.use({ reducedMotion: motion });

    test("below-the-fold content becomes visible", async ({ page }) => {
      await page.goto("/ar", { waitUntil: "domcontentloaded" });

      const reveals = page.locator("[data-reveal]");
      const count = await reveals.count();
      expect(count, "the landing page should have revealable sections").toBeGreaterThan(0);

      // Scroll to the bottom in steps so every observer gets a chance to fire;
      // IntersectionObserver only reports what actually intersected.
      await page.evaluate(async () => {
        const step = Math.round(window.innerHeight * 0.8);
        for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 120));
        }
        window.scrollTo(0, document.documentElement.scrollHeight);
      });

      // The page's own fail-safe reveals anything still pending after 2s, so 3s
      // is the contract: past this, a hidden element is a real regression.
      await expect
        .poll(
          async () =>
            page.evaluate(() =>
              Array.from(document.querySelectorAll("[data-reveal]")).every(
                (el) => getComputedStyle(el).opacity === "1",
              ),
            ),
          { timeout: 3_000, message: "a revealable element stayed at opacity 0" },
        )
        .toBe(true);
    });
  });
}

/**
 * The sign-in form is the page that was actually broken, so its content is
 * asserted rather than only its status: a 200 with an empty body would pass the
 * loop above.
 */
test.describe("sign-in renders its form", () => {
  for (const { path, label } of [
    { path: "/ar/sign-in", label: "تسجيل الدخول" },
    { path: "/en/sign-in", label: "Sign in" },
  ]) {
    test(`${path} shows the email and password fields`, async ({ page }) => {
      await page.goto(path, { waitUntil: "domcontentloaded" });

      await expect(page.getByRole("heading", { level: 1 })).toHaveText(label);
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();

      // Translated text, not raw message keys: next-intl being unwired also
      // shows up as a page that renders because it caught the error and
      // printed "auth.signInTitle".
      const body = await page.locator("body").innerText();
      expect(body).not.toContain("signInTitle");
      expect(body).not.toContain("err_invalid_credentials");
    });
  }
});
/**
 * The bare domain.
 *
 * `/` had no test, and it was broken in the quietest possible way: a static page
 * whose build-time `redirect()` was served as a 307 with NO Location header, so
 * anyone typing the domain got an error page. A status check alone would have
 * passed — 307 is a redirect status — which is why the Location assertion is the
 * point of this test.
 */
test.describe("/", () => {
  test("redirects to a locale landing page with a real Location", async ({ request }) => {
    const res = await request.get("/", { maxRedirects: 0 });

    expect([307, 308], `GET / returned ${res.status()}`).toContain(res.status());
    const location = res.headers()["location"];
    expect(location, "a redirect without a Location header is a dead link").toBeTruthy();
    expect(location).toMatch(/\/(ar|en)$/);
  });

  test("follows the visitor's language, Arabic by default", async ({ request }) => {
    const en = await request.get("/", {
      maxRedirects: 0,
      headers: { "accept-language": "en-GB,en;q=0.9" },
    });
    expect(en.headers()["location"]).toMatch(/\/en$/);

    const ar = await request.get("/", {
      maxRedirects: 0,
      headers: { "accept-language": "fr-FR,fr;q=0.9" },
    });
    expect(ar.headers()["location"]).toMatch(/\/ar$/);
  });
});
