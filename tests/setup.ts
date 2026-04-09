import "@testing-library/jest-dom/vitest";

// Populate NEXT_PUBLIC_* before any module that imports `@/lib/env`
// evaluates — env.ts throws at import time on missing values.
process.env.NEXT_PUBLIC_API_URL ??= "https://paper-trail-backend-7h27.onrender.com";
process.env.NEXT_PUBLIC_SITE_URL ??= "http://localhost:3000";
