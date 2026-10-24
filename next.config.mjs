/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lint is NOT skipped. ESLint runs both as its own CI step (for clear
  // attribution) and during the build, so a lint error cannot reach main.
  eslint: { ignoreDuringBuilds: false },
  poweredByHeader: false,
  reactStrictMode: true,
};
export default nextConfig;
