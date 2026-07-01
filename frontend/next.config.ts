import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `http://conn3ct-backend-service/api/:path*`, // Proxy to Backend
      },
    ];
  },
};

export default nextConfig;
