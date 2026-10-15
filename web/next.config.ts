import type { NextConfig } from "next";

// cacheComponents / partialPrefetching (template defaults) are server-render
// optimisations; this demo renders entirely client-side from in-browser
// sample data, so they only add dev-mode validation noise. Revisit when
// pages start fetching from the backend.
const nextConfig: NextConfig = {
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
