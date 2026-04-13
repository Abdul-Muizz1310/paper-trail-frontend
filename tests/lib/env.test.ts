import { describe, expect, it, vi } from "vitest";

describe("env validation", () => {
  it("F1 throws when NEXT_PUBLIC_API_URL is missing or invalid", async () => {
    // Temporarily override env vars with invalid values
    vi.stubEnv("NEXT_PUBLIC_API_URL", "not-a-url");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");

    // Dynamically re-import env.ts to trigger the validation with bad values
    // We need to bust the module cache first
    vi.resetModules();

    await expect(async () => {
      await import("@/lib/env");
    }).rejects.toThrow(/Invalid environment configuration/);

    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("F2 throws when NEXT_PUBLIC_SITE_URL is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://example.com");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");

    vi.resetModules();

    await expect(async () => {
      await import("@/lib/env");
    }).rejects.toThrow(/Invalid environment configuration/);

    vi.unstubAllEnvs();
    vi.resetModules();
  });
});
