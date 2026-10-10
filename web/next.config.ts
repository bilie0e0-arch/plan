import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page is per-user and dynamic; the classic dynamic model is simpler and safer here.
  cacheComponents: false,
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
