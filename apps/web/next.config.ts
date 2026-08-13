import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@proofsheet/db", "@proofsheet/interfaze"],
  serverExternalPackages: ["sharp"],
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
