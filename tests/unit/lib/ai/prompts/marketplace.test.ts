// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import {
  MARKETPLACE_SYSTEM_PROMPT,
  buildMarketplacePrompt,
} from "@/lib/ai/prompts/marketplace";

/**
 * Full product fixture used to drive `buildMarketplacePrompt` with
 * every field populated. Mirrors the shape of a row from the
 * `products` table after the RLS-scoped `select` in
 * `lib/actions/marketplace.ts`.
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
  platform: "shopee" as const,
  style: "profesional" as const,
  length: "sedang" as const,
  includeSpecs: true,
  targetAudience: "Wanita 25-35 tahun peduli skincare",
};

describe("MARKETPLACE_SYSTEM_PROMPT", () => {
  it("requires valid JSON output", () => {
    expect(MARKETPLACE_SYSTEM_PROMPT).toMatch(/JSON/i);
  });

  it("requires Bahasa Indonesia output copy", () => {
    expect(MARKETPLACE_SYSTEM_PROMPT).toMatch(/Bahasa Indonesia/i);
  });

  it("includes the marketplace output schema fields (title, description, bulletPoints, tags, cta)", () => {
    // The marketplace product description has a unique shape: a
    // headline-style `title`, a `shortDescription` hook, the full
    // `description`, an array of `bulletPoints` for feature lists,
    // `tags` for SEO, and a closing `cta`.
    const prompt = MARKETPLACE_SYSTEM_PROMPT.toLowerCase();
    expect(prompt).toMatch(/title/);
    expect(prompt).toMatch(/description/);
    expect(prompt).toMatch(/bulletpoints|bullet points/);
    expect(prompt).toMatch(/tags/);
    expect(prompt).toMatch(/cta|call[- ]to[- ]action/);
  });
});

describe("buildMarketplacePrompt", () => {
  it("interpolates the product name, platform, style, length, and includeSpecs", () => {
    const prompt = buildMarketplacePrompt(BASE_INPUT);

    expect(prompt).toContain("Serum Vitamin C Premium");
    expect(prompt).toContain("shopee");
    expect(prompt).toContain("profesional");
    expect(prompt).toContain("sedang");
  });

  it("includes the product context block (brand, category, USP, benefits, target market)", () => {
    const prompt = buildMarketplacePrompt(BASE_INPUT);

    expect(prompt).toContain("GlowLab");
    expect(prompt).toContain("kecantikan");
    expect(prompt).toMatch(/USP|unique selling point/i);
    expect(prompt).toMatch(/manfaat|benefits/i);
  });

  it("asks for bullet-point specs only when includeSpecs is true", () => {
    const withSpecs = buildMarketplacePrompt({
      ...BASE_INPUT,
      includeSpecs: true,
    });
    const withoutSpecs = buildMarketplacePrompt({
      ...BASE_INPUT,
      includeSpecs: false,
    });

    // The two prompts must differ when includeSpecs flips.
    expect(withSpecs).not.toBe(withoutSpecs);
    // includeSpecs=true should mention spec/feature/bullet.
    expect(withSpecs.toLowerCase()).toMatch(
      /spesifikasi|spec|fitur|bullet/,
    );
  });

  it("replaces null/empty product fields with graceful placeholders", () => {
    const prompt = buildMarketplacePrompt({
      ...BASE_INPUT,
      product: {
        ...FULL_PRODUCT,
        brand: null,
        usp: "",
        benefits: null,
      },
    });

    // The prompt must not contain the literal string "null".
    expect(prompt).not.toMatch(/\bnull\b/);
    // Brand placeholder.
    expect(prompt).toMatch(/tidak diketahui|umum/i);
  });

  it("includes the JSON output schema (title, shortDescription, description, bulletPoints, tags, cta) in the prompt", () => {
    const prompt = buildMarketplacePrompt(BASE_INPUT);

    expect(prompt).toContain('"title"');
    expect(prompt).toContain('"shortDescription"');
    expect(prompt).toContain('"description"');
    expect(prompt).toContain('"bulletPoints"');
    expect(prompt).toContain('"tags"');
    expect(prompt).toContain('"cta"');
  });
});
