import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for AffiliateAI Studio E2E tests.
 *
 * - Single worker (`workers: 1`) + non-parallel (`fullyParallel: false`)
 *   keep test execution predictable and prevent the dev server's
 *   single port from being raced for by concurrent test processes.
 * - `webServer` boots `pnpm dev` before tests and reuses an already-
 *   running server locally so devs don't pay the ~30s Next.js cold
 *   start on every test run.
 * - CI flips retries + reporter to "list" (deterministic logs, no HTML).
 * - Trace + screenshot are kept only on failure to keep artifacts small.
 *
 * Full E2E auth flow (real Supabase session, OAuth roundtrip, AI
 * generation) lands in Plan 3 once a real Supabase project is wired up.
 * For Plan 1 we only assert that the app shell renders, protected
 * routes redirect, and the public auth callback route exists.
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./tests/e2e",
  // Tests share a single dev server; avoid parallel workers that would
  // race for the same port and produce flaky, non-reproducible runs.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "list" : "list",

  // Timeouts — generous on the navigation/dev server boot side, tight
  // on assertions so a regression surfaces fast.
  timeout: 30 * 1000,
  expect: { timeout: 5 * 1000 },

  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 10 * 1000,
    navigationTimeout: 15 * 1000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Auto-start the Next.js dev server when the suite runs locally.
  // In CI the runner usually pre-builds/pre-starts the server, but we
  // keep this as a safety net.
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
