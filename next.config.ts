import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Production optimizations */
  reactStrictMode: true,
  compress: true,

  /* Environment variables for production */
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },

  /* Headers for security and CORS */
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
          { key: "Access-Control-Max-Age", value: "86400" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },

  /* Image optimization */
  images: {
    domains: ["messy-ragcx.vercel.app"], // Updated with actual production domain
    unoptimized: false,
  },

  /* Output configuration for deployment */
  output: "standalone",

  /* PoweredByHeader removal for security */
  poweredByHeader: false,
};

export default nextConfig;
