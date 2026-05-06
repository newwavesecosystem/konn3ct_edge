import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `https://${process.env.NEXT_PUBLIC_BACKEND_DOMAIN || 'konn3ctedge.konn3ct.net'}/api/:path*`, // Proxy to Backend
      },
    ];
  },
};

export default nextConfig;
