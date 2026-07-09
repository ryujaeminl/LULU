import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack is the default bundler in Next.js 16.
  // No special config needed — @mediapipe is loaded via CDN <Script> tag.
  turbopack: {},
};

export default nextConfig;
