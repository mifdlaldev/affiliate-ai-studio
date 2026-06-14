import { describe, it, expect } from "vitest";
import { productSchema } from "@/lib/validation/product";

describe("productSchema", () => {
  it("validates a complete valid product", () => {
    const result = productSchema.safeParse({
      name: "Serum Vitamin C",
      category: "kecantikan",
      brand: "BrandX",
      price: "Rp 150.000",
      target_market: "Wanita 20-30",
      usp: "Mencerahkan kulit",
      benefits: "Antioksidan\nMelembabkan",
      image_url: null,
      reference_link: null,
    });
    expect(result.success).toBe(true);
  });

  it("requires name (non-empty)", () => {
    const result = productSchema.safeParse({
      name: "",
      category: "",
      brand: "",
      price: "",
      target_market: "",
      usp: "",
      benefits: "",
      image_url: null,
      reference_link: null,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("name");
    }
  });

  it("rejects name over 200 chars", () => {
    const result = productSchema.safeParse({
      name: "a".repeat(201),
      category: null,
      brand: null,
      price: null,
      target_market: null,
      usp: null,
      benefits: null,
      image_url: null,
      reference_link: null,
    });
    expect(result.success).toBe(false);
  });

  it("accepts null for optional fields", () => {
    const result = productSchema.safeParse({
      name: "Test Product",
      category: null,
      brand: null,
      price: null,
      target_market: null,
      usp: null,
      benefits: null,
      image_url: null,
      reference_link: null,
    });
    expect(result.success).toBe(true);
  });

  it("validates reference_link is a URL or empty", () => {
    const validResult = productSchema.safeParse({
      name: "Test",
      category: null,
      brand: null,
      price: null,
      target_market: null,
      usp: null,
      benefits: null,
      image_url: null,
      reference_link: "https://shopee.co.id/test",
    });
    expect(validResult.success).toBe(true);

    const emptyResult = productSchema.safeParse({
      name: "Test",
      category: null,
      brand: null,
      price: null,
      target_market: null,
      usp: null,
      benefits: null,
      image_url: null,
      reference_link: "",
    });
    expect(emptyResult.success).toBe(true);

    const invalidResult = productSchema.safeParse({
      name: "Test",
      category: null,
      brand: null,
      price: null,
      target_market: null,
      usp: null,
      benefits: null,
      image_url: null,
      reference_link: "not-a-url",
    });
    expect(invalidResult.success).toBe(false);
  });
});
