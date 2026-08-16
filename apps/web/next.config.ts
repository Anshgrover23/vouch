import type { NextConfig } from "next";
import { loadRootEnv } from "../../packages/db/src/load-env";

// Middleware runs on Edge and never calls loadRootEnv(). Without this, Node
// (login + SiteChrome) signs/reads SESSION_SECRET from repo-root .env.local
// while middleware HMAC-verifies with the fallback — cookie looks logged-in
// in the header and 307s /inbox back to /login.
loadRootEnv();

const nextConfig: NextConfig = {
  transpilePackages: ["@proofsheet/db", "@proofsheet/interfaze"],
  serverExternalPackages: ["sharp"],
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
    optimizePackageImports: ["recharts"],
  },
};

export default nextConfig;
