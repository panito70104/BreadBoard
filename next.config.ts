import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Pin the workspace root so a stray lockfile above the repo is ignored.
    root: path.resolve("."),
  },
};

export default nextConfig;
