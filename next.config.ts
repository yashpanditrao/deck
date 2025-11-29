import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "qxglmugxqulsuivbckcm.supabase.co",
        pathname: "/storage/v1/object/public/rgstuff/**",
      },
    ],
  },
};

export default nextConfig;
