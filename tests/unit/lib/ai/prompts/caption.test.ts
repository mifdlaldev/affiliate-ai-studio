// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import {
  CAPTION_SYSTEM_PROMPT,
  buildCaptionPrompt,
} from "@/lib/ai/prompts/caption";

const FULL_PRODUCT = {
  name: "Serum Vitamin C Premium",
  brand: "GlowLab",
  category: "kecantikan",
  target_market: "Wanita 25-35 tahun, peduli skincare anti-aging",
  usp: "Mengandung 20% Vitamin C murni + Niacinamide untuk kulit cerah merata",
  benefits: "Mencerahkan kulit dalam 14 hari\nMengurangi noda hitam\nMelembabkan",
};

describe("CAPTION_SYSTEM_PROMPT", () => {
  it("requires output to be valid JSON only", () => {
    expect(CAPTION_SYSTEM_PROMPT).toMatch(/JSON/i);
  });

  it("requires Bahasa Indonesia", () => {
    expect(CAPTION_SYSTEM_PROMPT).toMatch(/Bahasa Indonesia/i);
  });

  it("instructs the model to generate multiple captions", () => {
    // The product needs 3-5 caption variations, so the system prompt must
    // mention a count or "variations"/"array" semantics.
    expect(CAPTION_SYSTEM_PROMPT).toMatch(/3|variasi|array|\d/i);
  });
});

describe("buildCaptionPrompt", () => {
  it("interpolates the product name, platform, tone, audience, and cta", () => {
    const prompt = buildCaptionPrompt({
      product: FULL_PRODUCT,
      platform: "tiktok",
      tone: "casual",
      audience: "mahasiswi",
      cta: "beli-sekarang",
    });
    expect(prompt).toContain(FULL_PRODUCT.name);
    expect(prompt).toContain("tiktok");
    expect(prompt).toContain("casual");
    expect(prompt).toContain("mahasiswi");
    expect(prompt).toContain("beli-sekarang");
  });

  it("includes the product brand, category, USP, and benefits when provided", () => {
    const prompt = buildCaptionPrompt({
      product: FULL_PRODUCT,
      platform: "instagram",
      tone: "professional",
      audience: "ibu rumah tangga",
      cta: "kunjungi",
    });
    expect(prompt).toContain(FULL_PRODUCT.brand!);
    expect(prompt).toContain(FULL_PRODUCT.category!);
    expect(prompt).toContain(FULL_PRODUCT.target_market!);
    expect(prompt).toContain(FULL_PRODUCT.usp!);
    expect(prompt).toContain("Mencerahkan kulit dalam 14 hari");
  });

  it("falls back to placeholder text when product fields are null", () => {
    const prompt = buildCaptionPrompt({
      product: {
        name: "Produk Misterius",
        brand: null,
        category: null,
        target_market: null,
        usp: null,
        benefits: null,
      },
      platform: "youtube",
      tone: "inspirational",
      audience: "umum",
      cta: null,
    });
    // Should NOT contain "null" literally — should have a graceful placeholder.
    expect(prompt).not.toContain("null");
    // Should still include the product name (the one non-null field).
    expect(prompt).toContain("Produk Misterius");
  });

  it("produces different prompts for different platforms", () => {
    const tiktok = buildCaptionPrompt({
      product: FULL_PRODUCT,
      platform: "tiktok",
      tone: "casual",
      audience: "gen-z",
      cta: "beli-sekarang",
    });
    const linkedin = buildCaptionPrompt({
      product: FULL_PRODUCT,
      platform: "linkedin" as string, // intentionally non-standard to test interpolation
      tone: "casual",
      audience: "gen-z",
      cta: "beli-sekarang",
    });
    expect(tiktok).not.toBe(linkedin);
    expect(tiktok).toContain("tiktok");
    expect(linkedin).toContain("linkedin");
  });

  it("includes the JSON output schema in the prompt", () => {
    const prompt = buildCaptionPrompt({
      product: FULL_PRODUCT,
      platform: "instagram",
      tone: "casual",
      audience: "umum",
      cta: "tanya",
    });
    // Caption objects need text + hashtags + tips; schema must appear.
    expect(prompt).toContain('"text"');
    expect(prompt).toContain('"hashtags"');
    expect(prompt).toContain('"tips"');
  });
});
