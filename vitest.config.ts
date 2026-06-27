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
      thresholds: { lines: 75, statements: 75, branches: 70, functions: 65 },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
