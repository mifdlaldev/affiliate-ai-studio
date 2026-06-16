import { describe, it, expect } from "vitest";
import { generateSocialSchema } from "@/lib/validation/social";

/**
 * Validation tests for the Social Media Content Calendar form.
 *
 * The form has 3 fields:
 * - `productId`: UUID of a saved product from the `products` table
 * - `platform`: which social platform the 7-day calendar is for
 *               (tiktok / instagram / youtube / twitter / facebook)
 * - `tone`: voice/style of the social copy (kasual / profesional /
 *          energik / inspiratif / edukatif)
 *
 * Error messages are in Indonesian to match the UI copy.
 */

const VALID_UUID = "55555555-5555-4555-8555-555555555555";

describe("generateSocialSchema", () => {
  // 1. Happy path — every field present and well-formed.
  it("validates a complete input with tiktok + kasual", () => {
    const result = generateSocialSchema.safeParse({
      productId: VALID_UUID,
      platform: "tiktok",
      tone: "kasual",
    });
    expect(result.success).toBe(true);
  });

  // 2. All five supported platforms are accepted.
  it.each(["tiktok", "instagram", "youtube", "twitter", "facebook"] as const)(
    "accepts platform '%s'",
    (platform) => {
      const result = generateSocialSchema.safeParse({
        productId: VALID_UUID,
        platform,
        tone: "energiK".toLowerCase() === "energiK" ? "energik" : "energik",
      });
      expect(result.success).toBe(true);
    },
  );

  // 3. All five supported tones are accepted.
  it.each([
    "kasual",
    "profesional",
    "energik",
    "inspiratif",
    "edukatif",
  ] as const)("accepts tone '%s'", (tone) => {
    const result = generateSocialSchema.safeParse({
      productId: VALID_UUID,
      platform: "instagram",
      tone,
    });
    expect(result.success).toBe(true);
  });

  // 4. Non-UUID productId is rejected.
  it("rejects a non-UUID productId", () => {
    const result = generateSocialSchema.safeParse({
      productId: "not-a-uuid",
      platform: "tiktok",
      tone: "kasual",
    });
    expect(result.success).toBe(false);
  });

  // 5. Missing productId is rejected.
  it("rejects when productId is missing", () => {
    const result = generateSocialSchema.safeParse({
      platform: "tiktok",
      tone: "kasual",
    });
    expect(result.success).toBe(false);
  });

  // 6. Unsupported platform is rejected.
  it("rejects an unsupported platform", () => {
    const result = generateSocialSchema.safeParse({
      productId: VALID_UUID,
      platform: "myspace",
      tone: "kasual",
    });
    expect(result.success).toBe(false);
  });

  // 7. Unsupported tone is rejected.
  it("rejects an unsupported tone", () => {
    const result = generateSocialSchema.safeParse({
      productId: VALID_UUID,
      platform: "tiktok",
      tone: "agresif",
    });
    expect(result.success).toBe(false);
  });

  // 8. Indonesian error message is surfaced for the user.
  it("returns an Indonesian error message for an invalid platform", () => {
    const result = generateSocialSchema.safeParse({
      productId: VALID_UUID,
      platform: "myspace",
      tone: "kasual",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      expect(firstIssue?.message).toMatch(/platform|pilih/i);
    }
  });
});
