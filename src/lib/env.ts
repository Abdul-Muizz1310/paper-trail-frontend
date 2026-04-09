import { z } from "zod";

/**
 * Runtime validation for NEXT_PUBLIC_* environment variables.
 *
 * Only `NEXT_PUBLIC_*` vars are inlined by Next.js on the client, so we
 * reference them as literal `process.env.NEXT_PUBLIC_FOO` (NOT via a
 * dynamic key) to ensure Webpack replaces them at build time.
 */
const EnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z
    .string()
    .url("NEXT_PUBLIC_API_URL must be a valid URL (e.g. https://paper-trail-backend.onrender.com)"),
  NEXT_PUBLIC_SITE_URL: z.string().url("NEXT_PUBLIC_SITE_URL must be a valid URL"),
});

export type Env = z.infer<typeof EnvSchema>;

const parsed = EnvSchema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env: Env = parsed.data;
