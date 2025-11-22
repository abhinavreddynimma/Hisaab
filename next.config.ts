import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/hisaab",
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
