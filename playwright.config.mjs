import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke suite for the public, unauthenticated surface.
 *
 * Every assertion here exists because a real defect shipped past type-check,
 * lint and the unit tests:
 *
 *  - `/sign-in` returned 500 in every environment because next-intl was
 *    installed but never wired through its plugin. The page is `force-dynamic`,
 *    so `next build` never rendered it and CI stayed green (ADR-014).
 *  - `/en` served English copy inside `<html lang="ar" dir="rtl">`, because the
 *    document shell was hard-coded to the default language (ADR-014).
 *  - Every section below the hero sat at `opacity: 0` when the reveal's client
 *    effect did not run, turning any script or hydration failure into a blank
 *    page (ADR-014).
 *
 * So this suite asserts the three things those tests structurally could not:
 * a route answers 200, the document declares the right language and direction,
 * and hidden content becomes visible after load.
 */
const PORT = Number(process.env.SMOKE_PORT ?? 3000);
const baseURL = process.env.SMOKE_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/smoke",
  // The whole suite is a page-load check; anything slower than this is the
  // failure, not a slow machine.
  timeout: 45_000,
  expect: { timeout: 10_000 },
  // A regression here is not flaky: no retries, so a failure is always visible.
  retries: 0,
  // Parallel workers each hold a browser; the smoke set is small and sequential
  // runs keep the resource footprint sane on a 1-core runner.
  workers: 1,
  fullyParallel: false,
  reporter: process.env.CI ? [["list"], ["github"]] : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Start the app only when SMOKE_BASE_URL is not supplied. `reuseExistingServer`
  // keeps a local `npm run dev` usable while iterating.
  ...(process.env.SMOKE_BASE_URL
    ? {}
    : {
        webServer: {
          command: `npm run build && npx next start -p ${PORT}`,
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 300_000,
        },
      }),
});