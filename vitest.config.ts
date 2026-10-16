import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      // `include` already counts every src file (vitest 4 makes the old
      // `all: true` the default; the explicit key no longer typechecks).
      include: ["src/**"],
      thresholds: {
        lines: 75,
        statements: 75,
        branches: 70,
        functions: 65,
        // Per-module floor for the signing proxy (spec 05): every guard is a case.
        "src/lib/server/**": { lines: 100, statements: 100, branches: 100, functions: 100 },
        "src/app/api/**": { lines: 100, statements: 100, branches: 100, functions: 100 },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Next resolves `server-only` itself (a build error in a client bundle);
      // outside Next it is the same empty module Next uses on the server.
      "server-only": path.resolve(__dirname, "node_modules/next/dist/compiled/server-only/empty.js"),
    },
  },
});
