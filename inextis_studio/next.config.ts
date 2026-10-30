import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Renders and thumbnails created after `next start` aren't in its static file list
  async rewrites() {
    return { beforeFiles: [], afterFiles: [], fallback: [{ source: "/projects/:path*", destination: "/api/files/:path*" }] };
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
