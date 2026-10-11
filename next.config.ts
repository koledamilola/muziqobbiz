import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Home goes straight to the main page. A config redirect (not redirect() in
  // a page) avoids a Next.js 16 prerender-check error.
  // Docs: https://nextjs.org/docs/app/api-reference/config/next-config-js/redirects
  async redirects() {
    return [{ source: "/", destination: "/muziqobbiz", permanent: false }];
  },
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
