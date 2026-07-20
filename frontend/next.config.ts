import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Turbopack rooted in this app (avoids picking ~/package-lock.json)
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
