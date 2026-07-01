import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  // Turbopack root is for `next dev --turbopack` only; omit during `next build` (webpack).
  ...(process.env.NODE_ENV !== "production" && {
    turbopack: {
      root: projectRoot,
    },
  }),
};

export default nextConfig;
