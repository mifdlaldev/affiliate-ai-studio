// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import {
  SOCIAL_SYSTEM_PROMPT,
  buildSocialPrompt,
} from "@/lib/ai/prompts/social";

/**
 * Full product fixture used to drive `buildSocialPrompt` with every
 * field populated. Mirrors the shape of a row from the `products`
 * table after the RLS-scoped `select` in `lib/actions/social.ts`.
 */
const FULL_PRODUCT = {
  name: "Serum Vitamin C Premium",
  brand: "GlowLab",
  category: "kecantikan",
  price: "Rp 150.000",
  target_market: "Wanita 25-35 tahun, peduli skincare anti-aging",
  usp: "Mengandung 20% Vitamin C murni + Niacinamide untuk kulit cerah merata",
  benefits:
    "Mencerahkan kulit dalam 14 hari\nMengurangi noda hitam\nMelembabkan",
};

const BASE_INPUT = {
  product: FULL_PRODUCT,
  platform: "tiktok" as const,
  tone: "kasual" as const,
};

describe("SOCIAL_SYSTEM_PROMPT", () => {
  // 1. Requires JSON output
  it("requires valid JSON output", () => {
    expect(SOCIAL_SYSTEM_PROMPT).toMatch(/JSON/i);
  });

  // 2. Requires Bahasa Indonesia copy
  it("requires Bahasa Indonesia output copy", () => {
    expect(SOCIAL_SYSTEM_PROMPT).toMatch(/Bahasa Indonesia/i);
  });

  // 3. Documents the output schema (platform, days, day, contentType,
  //    topic, caption, hashtags, bestTime) so the model knows what to
  //    produce.
  it("documents the 7-day calendar output schema (platform, days, day, contentType, topic, caption, hashtags, bestTime)", () => {
    expect(SOCIAL_SYSTEM_PROMPT).toMatch(/"platform"/);
    expect(SOCIAL_SYSTEM_PROMPT).toMatch(/"days"/);
    expect(SOCIAL_SYSTEM_PROMPT).toMatch(/"day"/);
    expect(SOCIAL_SYSTEM_PROMPT).toMatch(/"contentType"/);
    expect(SOCIAL_SYSTEM_PROMPT).toMatch(/"topic"/);
    expect(SOCIAL_SYSTEM_PROMPT).toMatch(/"caption"/);
    expect(SOCIAL_SYSTEM_PROMPT).toMatch(/"hashtags"/);
    expect(SOCIAL_SYSTEM_PROMPT).toMatch(/"bestTime"/);
  });
});

describe("buildSocialPrompt", () => {
  // 4. Includes the chosen platform in the prompt.
  it("includes the chosen platform in the prompt", () => {
    const prompt = buildSocialPrompt({
      ...BASE_INPUT,
      platform: "instagram",
    });
    expect(prompt).toMatch(/instagram/i);
  });

  // 5. Includes the chosen tone in the prompt.
  it("includes the chosen tone in the prompt", () => {
    const prompt = buildSocialPrompt({ ...BASE_INPUT, tone: "energik" });
    expect(prompt).toMatch(/energik/i);
  });

  // 6. Embeds product context (name, brand, USP) into the prompt.
  it("embeds the product name, brand, and USP into the prompt", () => {
    const prompt = buildSocialPrompt(BASE_INPUT);
    expect(prompt).toMatch(/Serum Vitamin C Premium/);
    expect(prompt).toMatch(/GlowLab/);
    expect(prompt).toMatch(/20% Vitamin C murni/);
  });

  // 7. Replaces null/empty product fields with graceful placeholders
  //    instead of the literal string "null".
  it("replaces null/empty product fields with placeholders (no literal 'null')", () => {
    const prompt = buildSocialPrompt({
      ...BASE_INPUT,
      product: {
        name: "Produk X",
        brand: null,
        category: null,
        price: null,
        target_market: null,
        usp: null,
        benefits: null,
      },
    });
    expect(prompt).not.toMatch(/\bnull\b/);
    expect(prompt).toMatch(/tidak diketahui|umum/i);
  });

  // 8. Specifies 7 days of content in the output schema.
  it("specifies 7 days of content in the output schema", () => {
    const prompt = buildSocialPrompt(BASE_INPUT);
    expect(prompt).toMatch(/7/);
    expect(prompt).toMatch(/hari|day/i);
  });
});
