import type { NextConfig } from "next";

/**
 * Tauri serves a STATIC export — there is no Node server in the desktop app.
 * All real work (orchestration, agents, secrets) lives in the cloud backend
 * (Spec 2.4). The client is a pure live window, so static export is correct,
 * not a limitation.
 */
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
