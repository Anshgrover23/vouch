import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@proofsheet/db", "@proofsheet/interfaze"],
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
