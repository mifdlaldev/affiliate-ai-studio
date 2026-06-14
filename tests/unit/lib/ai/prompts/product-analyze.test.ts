import { describe, it, expect } from "vitest";
import {
  buildProductAnalyzePrompt,
  PRODUCT_ANALYZE_SYSTEM_PROMPT,
} from "@/lib/ai/prompts/product-analyze";

const DATA_URL = "data:image/jpeg;base64,/9j/AAAA";

describe("PRODUCT_ANALYZE_SYSTEM_PROMPT", () => {
  it("forbids 'Unknown' as a field value", () => {
    // Critical guardrail: the model must make best-guess estimates, never
    // return the literal string "Unknown" for any field.
    expect(PRODUCT_ANALYZE_SYSTEM_PROMPT).toMatch(/Unknown/i);
    expect(PRODUCT_ANALYZE_SYSTEM_PROMPT).toMatch(/JANGAN|don't|never/i);
  });

  it("requires output to be valid JSON only", () => {
    expect(PRODUCT_ANALYZE_SYSTEM_PROMPT).toMatch(/HANYA JSON|only JSON/i);
  });

  it("requires Bahasa Indonesia for all field values", () => {
    expect(PRODUCT_ANALYZE_SYSTEM_PROMPT).toMatch(/Bahasa Indonesia/i);
  });
});

describe("buildProductAnalyzePrompt", () => {
  it("references visual analysis when image is present", () => {
    const prompt = buildProductAnalyzePrompt({
      imageUrl: DATA_URL,
      linkContext: "",
    });
    expect(prompt).toMatch(/gambar|image/i);
  });

  it("references the link when link context is present", () => {
    const prompt = buildProductAnalyzePrompt({
      imageUrl: "",
      linkContext: "https://shopee.co.id/test-product",
    });
    expect(prompt).toContain("https://shopee.co.id/test-product");
  });

  it("combines image + link instructions when both are present", () => {
    const prompt = buildProductAnalyzePrompt({
      imageUrl: DATA_URL,
      linkContext: "https://shopee.co.id/test",
    });
    expect(prompt).toMatch(/gambar|image/i);
    expect(prompt).toContain("https://shopee.co.id/test");
  });

  it("uses a 'no context' fallback when neither image nor link is provided", () => {
    const prompt = buildProductAnalyzePrompt({
      imageUrl: "",
      linkContext: "",
    });
    expect(prompt).toMatch(/TIDAK ADA KONTEKS|no context/i);
  });

  it("includes the JSON output schema in every prompt", () => {
    const promptWithImage = buildProductAnalyzePrompt({
      imageUrl: DATA_URL,
      linkContext: "",
    });
    expect(promptWithImage).toContain('"name"');
    expect(promptWithImage).toContain('"category"');
    expect(promptWithImage).toContain('"price"');
  });
});
