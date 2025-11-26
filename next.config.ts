import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* existing config options here */
  eslint: {
    // Ignore ESLint errors during builds
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Ignore TypeScript type errors during builds
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
