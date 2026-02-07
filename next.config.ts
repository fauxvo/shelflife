import type { NextConfig } from "next";
import { execSync } from "child_process";

// Expose version info at build time
const version = process.env.npm_package_version || "0.0.0";
let gitSha = "";
try {
  gitSha = execSync("git rev-parse --short HEAD").toString().trim();
} catch {
  // Not in a git repo (e.g. Docker build)
}

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
    NEXT_PUBLIC_GIT_SHA: gitSha,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
      },
      {
        protocol: "https",
        hostname: "plex.tv",
      },
    ],
  },
};

export default nextConfig;
