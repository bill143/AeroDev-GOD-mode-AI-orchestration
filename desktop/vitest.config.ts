import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    // Default environment is node so the live-backend integration test can use
    // child_process + global fetch/WebSocket. Component tests opt into jsdom
    // per-file via a `@vitest-environment jsdom` docblock.
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.{ts,tsx}"],
    testTimeout: 30_000,
    hookTimeout: 90_000,
  },
});
