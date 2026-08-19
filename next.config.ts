import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  productionBrowserSourceMaps: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "350mb",
    },
    middlewareClientMaxBodySize: "350mb",
  },
  // Hide the Next.js "N" badge in the corner during `next dev`.
  devIndicators: false,
  // Runtime uploads under public/uploads are not reliably served as static files
  // (especially files saved after next start). Route them through the API.
  async rewrites() {
    return [{ source: "/uploads/:path*", destination: "/api/uploads/:path*" }];
  },
  // Turbopack root is for `next dev --turbopack` only; omit during `next build` (webpack).
  ...(process.env.NODE_ENV !== "production" && {
    turbopack: {
      root: projectRoot,
    },
  }),
};

export default nextConfig;
