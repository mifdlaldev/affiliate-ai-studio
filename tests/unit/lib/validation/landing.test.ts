import { describe, it, expect } from "vitest";
import {
  generateLandingSchema,
  type GenerateLandingInput,
} from "@/lib/validation/landing";

/**
 * Validation tests for the Landing Page Generator form.
 *
 * The form has exactly 2 fields:
 * - `productId`: UUID of a saved product from the `products` table
 * - `tone`:      writing tone of the landing page copy
 *                (profesional / santai / persuasif / edukatif)
 *
 * The form is intentionally minimal (no audience, no length bucket)
 * because the model decides section length from the tone. All error
 * messages must be in Indonesian to match the UI copy.
 */

const VALID_PRODUCT_ID = "11111111-2222-4333-8444-555555555555";

const BASE_VALID_INPUT: GenerateLandingInput = {
  productId: VALID_PRODUCT_ID,
  tone: "profesional",
};

describe("generateLandingSchema", () => {
  // 1. Happy path
  it("accepts a valid productId (UUID) + valid tone", () => {
    const result = generateLandingSchema.safeParse(BASE_VALID_INPUT);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.productId).toBe(VALID_PRODUCT_ID);
      expect(result.data.tone).toBe("profesional");
    }
  });

  // 2. Missing productId
  it("rejects a missing/empty productId", () => {
    const result = generateLandingSchema.safeParse({
      productId: "",
      tone: "santai",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const productIdIssue = result.error.issues.find(
        (i) => i.path[0] === "productId",
      );
      expect(productIdIssue).toBeDefined();
    }
  });

  // 3. Invalid UUID format
  it("rejects a productId that is not a valid UUID", () => {
    const result = generateLandingSchema.safeParse({
      productId: "bukan-uuid",
      tone: "persuasif",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const productIdIssue = result.error.issues.find(
        (i) => i.path[0] === "productId",
      );
      expect(productIdIssue).toBeDefined();
    }
  });

  // 4. Missing tone
  it("rejects a missing tone", () => {
    const result = generateLandingSchema.safeParse({
      productId: VALID_PRODUCT_ID,
      tone: undefined,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const toneIssue = result.error.issues.find((i) => i.path[0] === "tone");
      expect(toneIssue).toBeDefined();
    }
  });

  // 5. Tone outside the allowed enum
  it("rejects a tone value outside the allowed enum", () => {
    const result = generateLandingSchema.safeParse({
      productId: VALID_PRODUCT_ID,
      // 'robotik' is intentionally not in the enum
      tone: "robotik",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const toneIssue = result.error.issues.find((i) => i.path[0] === "tone");
      expect(toneIssue).toBeDefined();
    }
  });

  // 6. All enum values are accepted (parameterized via it.each)
  it.each(["profesional", "santai", "persuasif", "edukatif"] as const)(
    "accepts tone '%s'",
    (tone) => {
      const result = generateLandingSchema.safeParse({
        productId: VALID_PRODUCT_ID,
        tone,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tone).toBe(tone);
      }
    },
  );

  // 7. Schema export shape — the action imports `generateLandingSchema`
  //    and the type is exported as `GenerateLandingInput`. This test
  //    guards against accidental renames.
  it("exports `generateLandingSchema` and `GenerateLandingInput` with the expected shape", () => {
    expect(generateLandingSchema).toBeDefined();
    // The type is erased at runtime, but a sample parse should produce
    // exactly the two fields we expect on the inferred type.
    const result = generateLandingSchema.safeParse(BASE_VALID_INPUT);
    if (result.success) {
      expect(Object.keys(result.data).sort()).toEqual(
        ["productId", "tone"].sort(),
      );
    }
  });
});
