import { test, expect } from "@playwright/test";

/**
 * Smoke tests for the public auth surface. These tests do not
 * authenticate — they only verify the login page renders correctly
 * and that protected routes bounce unauthenticated visitors to
 * /login. Full Magic Link + OAuth E2E arrives in Plan 3 once a
 * real Supabase project is wired up (real SMTP, real OAuth client,
 * real session cookies).
 */
test.describe("Auth pages", () => {
  test("login page loads with correct content", async ({ page }) => {
    await page.goto("/login");

    // Title comes from app/layout.tsx — sanity check the app shell
    // actually mounted and rendered the <title> element.
    await expect(page).toHaveTitle(/AffiliateAI/i);

    // Heading + tagline from app/(auth)/login/page.tsx
    await expect(
      page.getByRole("heading", { name: /Selamat Datang Kembali/i })
    ).toBeVisible();

    // Email input is labelled and present
    await expect(page.getByLabel(/email/i)).toBeVisible();

    // Magic link submit button
    await expect(
      page.getByRole("button", { name: /Kirim Magic Link/i })
    ).toBeVisible();

    // Google OAuth submit button
    await expect(
      page.getByRole("button", { name: /Lanjut dengan Google/i })
    ).toBeVisible();
  });

  test("protected /produk route redirects to /login when unauthenticated", async ({
    page,
  }) => {
    await page.goto("/produk");
    await expect(page).toHaveURL(/\/login/);
  });

  test("protected dashboard root redirects to /login when unauthenticated", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("email input has type=email and required attribute", async ({
    page,
  }) => {
    await page.goto("/login");
    const emailInput = page.getByLabel(/email/i);
    await expect(emailInput).toHaveAttribute("type", "email");
    await expect(emailInput).toHaveAttribute("required");
  });

  test("Google OAuth button contains the Google logo SVG", async ({
    page,
  }) => {
    await page.goto("/login");
    const googleButton = page.getByRole("button", {
      name: /Lanjut dengan Google/i,
    });
    await expect(googleButton).toBeVisible();
    // Google button has an inline <svg> for the multicolor "G" mark
    await expect(googleButton.locator("svg")).toBeVisible();
  });
});
