import { generateKeyPairSync } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const live = Boolean(process.env.E2E_LIVE);

// Mocked mode (docs/specs/05-backend-proxy.md §5): `next dev` signs with a
// throwaway Ed25519 pair made here and proxies to a local mock backend
// (tests/e2e/global-setup.ts) that verifies with the public half. The runner,
// the global setup and every worker share the pair through the environment:
// workers inherit it, so a worker loading this file again keeps the runner's.
if (!live && !process.env.E2E_SIGNING_KEY_PUBLIC) {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  process.env.E2E_SIGNING_KEY_PRIVATE = privateKey
    .export({ format: "der", type: "pkcs8" })
    .toString("base64");
  process.env.E2E_SIGNING_KEY_PUBLIC = publicKey
    .export({ format: "der", type: "spki" })
    .toString("base64");
}
process.env.E2E_MOCK_BACKEND_PORT ??= "3502";
const mockBackendUrl = `http://127.0.0.1:${process.env.E2E_MOCK_BACKEND_PORT}`;
process.env.E2E_MOCK_BACKEND_URL = mockBackendUrl;

// Live mode keeps the environment's backend URL and key (nightly-e2e.yml).
const backendEnv: Record<string, string> = live
  ? {
      NEXT_PUBLIC_API_URL:
        process.env.NEXT_PUBLIC_API_URL ?? "https://paper-trail-backend-jjpf.onrender.com",
    }
  : {
      NEXT_PUBLIC_API_URL: mockBackendUrl,
      PAPER_TRAIL_FRONTEND_SIGNING_KEY_PRIVATE: process.env.E2E_SIGNING_KEY_PRIVATE ?? "",
    };

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // A live retry is a whole new real debate on the free-model quota.
  retries: process.env.CI && !live ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL,
    // Live mode never retries, so keep its evidence on the first failure.
    trace: live ? "retain-on-failure" : "on-first-retry",
    screenshot: live ? "only-on-failure" : "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: baseURL,
    // Never reuse a running server: one started by hand may hold a real key
    // and the real backend's URL, and the composed spec would then create a
    // real debate.
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...backendEnv,
      NEXT_PUBLIC_SITE_URL: baseURL,
      PORT: new URL(baseURL).port || "3000",
    },
  },
});
