// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import {
  HOOK_SYSTEM_PROMPT,
  buildHookPrompt,
} from "@/lib/ai/prompts/hook";

const FULL_PRODUCT = {
  name: "Serum Vitamin C Premium",
  brand: "GlowLab",
  category: "kecantikan",
  target_market: "Wanita 25-35 tahun, peduli skincare anti-aging",
  usp: "Mengandung 20% Vitamin C murni + Niacinamide untuk kulit cerah merata",
  benefits: "Mencerahkan kulit dalam 14 hari\nMengurangi noda hitam\nMelembabkan",
};

describe("HOOK_SYSTEM_PROMPT", () => {
  it("requires output to be valid JSON only", () => {
    expect(HOOK_SYSTEM_PROMPT).toMatch(/JSON/i);
  });

  it("requires Bahasa Indonesia", () => {
    expect(HOOK_SYSTEM_PROMPT).toMatch(/Bahasa Indonesia/i);
  });

  it("instructs the model to generate multiple hooks", () => {
    // The product needs 3-5 hook variations, so the system prompt must
    // mention a count or "variations"/"array" semantics.
    expect(HOOK_SYSTEM_PROMPT).toMatch(/3|variasi|array|\d/i);
  });
});

describe("buildHookPrompt", () => {
  it("interpolates the product name, platform, tone, and audience", () => {
    const prompt = buildHookPrompt({
      product: FULL_PRODUCT,
      platform: "tiktok",
      tone: "casual",
      audience: "mahasiswi",
    });
    expect(prompt).toContain(FULL_PRODUCT.name);
    expect(prompt).toContain("tiktok");
    expect(prompt).toContain("casual");
    expect(prompt).toContain("mahasiswi");
  });

  it("includes the product brand, category, USP, and benefits when provided", () => {
    const prompt = buildHookPrompt({
      product: FULL_PRODUCT,
      platform: "instagram",
      tone: "professional",
      audience: "ibu rumah tangga",
    });
    expect(prompt).toContain(FULL_PRODUCT.brand!);
    expect(prompt).toContain(FULL_PRODUCT.category!);
    expect(prompt).toContain(FULL_PRODUCT.target_market!);
    expect(prompt).toContain(FULL_PRODUCT.usp!);
    expect(prompt).toContain("Mencerahkan kulit dalam 14 hari");
  });

  it("falls back to placeholder text when product fields are null", () => {
    const prompt = buildHookPrompt({
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
    });
    // Should NOT contain "null" literally — should have a graceful placeholder.
    expect(prompt).not.toContain("null");
    // Should still include the product name (the one non-null field).
    expect(prompt).toContain("Produk Misterius");
  });

  it("produces different prompts for different platforms", () => {
    const tiktok = buildHookPrompt({
      product: FULL_PRODUCT,
      platform: "tiktok",
      tone: "casual",
      audience: "gen-z",
    });
    const linkedin = buildHookPrompt({
      product: FULL_PRODUCT,
      platform: "linkedin" as string, // intentionally non-standard to test interpolation
      tone: "casual",
      audience: "gen-z",
    });
    expect(tiktok).not.toBe(linkedin);
    expect(tiktok).toContain("tiktok");
    expect(linkedin).toContain("linkedin");
  });

  it("includes the JSON output schema in the prompt", () => {
    const prompt = buildHookPrompt({
      product: FULL_PRODUCT,
      platform: "instagram",
      tone: "casual",
      audience: "umum",
    });
    // Hook objects need at minimum text + platform + tone; schema must appear.
    expect(prompt).toContain('"text"');
  });
});
