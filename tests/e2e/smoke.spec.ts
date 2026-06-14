import { test, expect } from "@playwright/test";

/**
 * App shell smoke tests — verify the public surface of the app
 * responds the way we expect (200s, 404s, callback route shape).
 * Anything that needs a real Supabase session is out of scope here.
 */
test.describe("App shell smoke tests", () => {
  test("404 page renders for unknown routes", async ({ page }) => {
    const response = await page.goto("/this-route-does-not-exist");
    // Next.js serves 404 for unknown paths under the app router
    expect(response?.status() ?? 200).toBeGreaterThanOrEqual(400);
  });

  test("login page is accessible at /login (HTTP 200)", async ({ page }) => {
    const response = await page.goto("/login");
    expect(response?.status()).toBe(200);
  });

  test("auth callback without a valid code redirects to /login?error", async ({
    page,
  }) => {
    // Hit the callback with a bogus code; the route handler should
    // refuse to exchange it and bounce to /login?error=auth_failed.
    const response = await page.goto(
      "/api/auth/callback?code=fake&next=/"
    );
    await expect(page).toHaveURL(/\/login\?error=auth_failed/);
    // The redirect itself is a 3xx, not a 5xx server crash
    expect(response?.status()).toBeLessThan(500);
  });
});
