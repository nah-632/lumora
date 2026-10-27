import createNextIntlPlugin from "next-intl/plugin";

/**
 * next-intl must be wired through this plugin, not merely installed.
 *
 * `getTranslations`/`useTranslations` resolve their request config through a
 * module alias that only this plugin creates (it points `next-intl/config` at
 * the file given here). With the package present but the plugin absent, every
 * page that calls a translation helper throws at request time:
 *
 *     Error: Couldn't find next-intl config file.
 *
 * Only the authenticated pages call those helpers, and they are all
 * `force-dynamic`, so `npm run build` never rendered them and CI stayed green
 * while /sign-in returned 500 in every environment that ran the code.
 *
 * The path is explicit because this project keeps its request config at
 * `./i18n.ts`. next-intl 3.26 resolves the default `./i18n/request.ts` only and
 * has no fallback to the older root `./i18n.ts` location, so calling the plugin
 * with no argument would fail to find it for a different reason. Moving the file
 * to satisfy the default was rejected: the file is authored and reviewed where
 * it is, and the explicit path documents the actual location instead of relying
 * on an implicit convention.
 */
const withNextIntl = createNextIntlPlugin("./i18n.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lint is NOT skipped. ESLint runs both as its own CI step (for clear
  // attribution) and during the build, so a lint error cannot reach main.
  eslint: { ignoreDuringBuilds: false },
  poweredByHeader: false,
  reactStrictMode: true,
};

export default withNextIntl(nextConfig);