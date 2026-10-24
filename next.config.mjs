/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lint runs as its own gate; keep the build focused on compilation.
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
  reactStrictMode: true,
};
export default nextConfig;
