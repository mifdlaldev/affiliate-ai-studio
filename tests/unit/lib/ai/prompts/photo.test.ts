// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import {
  PHOTO_SYSTEM_PROMPT,
  buildPhotoPrompt,
} from "@/lib/ai/prompts/photo";

const FULL_PRODUCT = {
  name: "Serum Vitamin C Premium",
  brand: "GlowLab",
  category: "kecantikan",
  target_market: "Wanita 25-35 tahun, peduli skincare anti-aging",
  usp: "Mengandung 20% Vitamin C murni + Niacinamide untuk kulit cerah merata",
  benefits: "Mencerahkan kulit dalam 14 hari\nMengurangi noda hitam\nMelembabkan",
};

const BASE_INPUT = {
  product: FULL_PRODUCT,
  style: "minimalist",
  mood: "warm",
  setting: "studio",
  composition: "close-up",
} as const;

describe("PHOTO_SYSTEM_PROMPT", () => {
  it("contains the required keywords (JSON, photo/prompt, English/Bahasa Inggris)", () => {
    // The system prompt must mention: JSON output format, photo/prompt
    // domain, and the English language requirement (for the visual
    // prompt field). Matches both "English" and the Indonesian
    // "Bahasa Inggris" since the system prompt itself is in Indonesian.
    expect(PHOTO_SYSTEM_PROMPT).toMatch(/JSON/i);
    expect(PHOTO_SYSTEM_PROMPT).toMatch(/photo|prompt/i);
    expect(PHOTO_SYSTEM_PROMPT).toMatch(/Bahasa Inggris|English/i);
  });
});

describe("buildPhotoPrompt", () => {
  it("includes the product name", () => {
    const prompt = buildPhotoPrompt(BASE_INPUT);
    expect(prompt).toContain(FULL_PRODUCT.name);
  });

  it("includes the style parameter", () => {
    const prompt = buildPhotoPrompt({ ...BASE_INPUT, style: "creative" });
    expect(prompt).toContain("creative");
  });

  it("includes the mood parameter", () => {
    const prompt = buildPhotoPrompt({ ...BASE_INPUT, mood: "dramatic" });
    expect(prompt).toContain("dramatic");
  });

  it("includes the setting parameter", () => {
    const prompt = buildPhotoPrompt({ ...BASE_INPUT, setting: "outdoor" });
    expect(prompt).toContain("outdoor");
  });

  it("includes the composition parameter", () => {
    const prompt = buildPhotoPrompt({
      ...BASE_INPUT,
      composition: "flat-lay",
    });
    expect(prompt).toContain("flat-lay");
  });

  it("handles null product fields gracefully (does not write literal 'null')", () => {
    const prompt = buildPhotoPrompt({
      product: {
        name: null,
        brand: null,
        category: null,
        target_market: null,
        usp: null,
        benefits: null,
      },
      style: "lifestyle",
      mood: "natural",
      setting: "lifestyle",
      composition: "flat-lay",
    });
    // The model must not be told to use literal "null" — it should fall
    // back to sensible placeholders.
    expect(prompt).not.toContain("null");
    // Should still contain the style/mood/setting/composition values.
    expect(prompt).toContain("lifestyle");
    expect(prompt).toContain("natural");
    expect(prompt).toContain("flat-lay");
  });

  it("produces different prompts for different styles", () => {
    const minimalist = buildPhotoPrompt({ ...BASE_INPUT, style: "minimalist" });
    const professional = buildPhotoPrompt({
      ...BASE_INPUT,
      style: "professional",
    });
    // Same product + same mood/setting/composition, only style changes.
    // The two prompts must differ (style-specific guidance appears).
    expect(minimalist).not.toBe(professional);
    expect(minimalist).toContain("minimalist");
    expect(professional).toContain("professional");
  });
});
