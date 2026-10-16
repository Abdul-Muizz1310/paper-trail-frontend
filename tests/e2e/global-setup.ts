import { startMockBackend } from "./fixtures/mock-backend";

/**
 * Starts the local mock backend the Next server proxies to (spec 05 §5).
 * `playwright.config.ts` chose its port and the throwaway key pair; live mode
 * (`E2E_LIVE=1`) talks to the real backend and starts nothing.
 */
export default async function globalSetup(): Promise<(() => Promise<void>) | undefined> {
  if (process.env.E2E_LIVE) return undefined;
  const port = Number(process.env.E2E_MOCK_BACKEND_PORT);
  const publicKeyB64 = process.env.E2E_SIGNING_KEY_PUBLIC;
  if (!Number.isInteger(port) || port <= 0 || !publicKeyB64) {
    throw new Error("playwright.config.ts did not set the mock backend's port and public key");
  }
  const backend = await startMockBackend({ port, publicKeyB64 });
  return backend.close;
}
