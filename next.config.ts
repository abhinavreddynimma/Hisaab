import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: "/hisaab",
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
