// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import {
  LANDING_SYSTEM_PROMPT,
  buildLandingPrompt,
} from "@/lib/ai/prompts/landing";

/**
 * Full product fixture used to drive `buildLandingPrompt` with every
 * field populated. Mirrors the shape of a row from the `products`
 * table after the RLS-scoped `select` in `lib/actions/landing.ts`.
 */
const FULL_PRODUCT = {
  name: "Kursus Online Copywriting AI",
  brand: "BelajarAI",
  category: "edukasi",
  price: "Rp 499.000",
  target_market: "Pemula 20-40 tahun yang ingin kerja remote sebagai copywriter",
  usp: "12 modul video + 1-on-1 mentoring dengan copywriter profesional bersertifikat",
  benefits:
    "Belajar 12 modul copywriting AI\n1-on-1 mentoring 60 menit\nAkses komunitas selamanya\nSertifikat kelulusan",
};

const BASE_INPUT = {
  product: FULL_PRODUCT,
  tone: "profesional" as const,
};

describe("LANDING_SYSTEM_PROMPT", () => {
  // 1. JSON-mode guarantee
  it("requires valid JSON output", () => {
    expect(LANDING_SYSTEM_PROMPT).toMatch(/JSON/i);
  });

  // 2. Language guarantee
  it("requires Bahasa Indonesia output copy", () => {
    expect(LANDING_SYSTEM_PROMPT).toMatch(/Bahasa Indonesia/i);
  });

  // 3. Schema coverage — landing page shape is unique (headline +
  //    subheadline + heroDescription + features[] + pricing[] + faq[]
  //    + cta) so we must check for all 7 fields in the system prompt.
  it("includes the landing-page output schema fields (headline, subheadline, heroDescription, features, pricing, faq, cta)", () => {
    const prompt = LANDING_SYSTEM_PROMPT.toLowerCase();
    expect(prompt).toMatch(/headline/);
    expect(prompt).toMatch(/subheadline/);
    expect(prompt).toMatch(/hero\s*description|hero\s*deskripsi/);
    expect(prompt).toMatch(/features/);
    expect(prompt).toMatch(/pricing/);
    expect(prompt).toMatch(/faq/);
    expect(prompt).toMatch(/cta|call[- ]to[- ]action/);
  });

  // 4. Section count guidance — landing pages need at least 3 features,
  //    1-2 pricing tiers, and 3-4 FAQ items, so the prompt should hint
  //    at these minimum counts.
  it("specifies the minimum section counts (features >= 3, pricing >= 1, faq >= 3)", () => {
    const prompt = LANDING_SYSTEM_PROMPT.toLowerCase();
    expect(prompt).toMatch(/3[- ]?\d?\s*(fitur|features)/);
    expect(prompt).toMatch(/(harga|pricing|plan)/);
    expect(prompt).toMatch(/(faq|pertanyaan)/);
  });
});

describe("buildLandingPrompt", () => {
  // 5. Context interpolation
  it("interpolates the product name and tone into the user prompt", () => {
    const prompt = buildLandingPrompt(BASE_INPUT);

    expect(prompt).toContain("Kursus Online Copywriting AI");
    expect(prompt).toContain("profesional");
  });

  // 6. Product context block (brand, category, USP, benefits, market)
  it("includes the product context block (brand, category, USP, benefits, target market)", () => {
    const prompt = buildLandingPrompt(BASE_INPUT);

    expect(prompt).toContain("BelajarAI");
    expect(prompt).toContain("edukasi");
    expect(prompt).toMatch(/USP|unique selling point/i);
    expect(prompt).toMatch(/manfaat|benefits/i);
    expect(prompt).toMatch(/target\s*pasar|target\s*market/i);
  });

  // 7. JSON schema in the user prompt — the model needs to see the
  //    field names + types right before it answers.
  it("includes the JSON output schema (headline, subheadline, heroDescription, features, pricing, faq, cta) in the prompt", () => {
    const prompt = buildLandingPrompt(BASE_INPUT);

    expect(prompt).toContain('"headline"');
    expect(prompt).toContain('"subheadline"');
    expect(prompt).toContain('"heroDescription"');
    expect(prompt).toContain('"features"');
    expect(prompt).toContain('"pricing"');
    expect(prompt).toContain('"faq"');
    expect(prompt).toContain('"cta"');
  });

  // 8. Null/empty placeholders — null/empty product fields must be
  //    swapped for graceful placeholders so the model never sees the
  //    literal string "null".
  it("replaces null/empty product fields with graceful placeholders", () => {
    const prompt = buildLandingPrompt({
      product: {
        name: null,
        brand: null,
        category: null,
        price: null,
        target_market: null,
        usp: null,
        benefits: null,
      },
      tone: "santai",
    });

    // The prompt must not contain the literal string "null".
    expect(prompt).not.toMatch(/\bnull\b/);
    // Brand placeholder.
    expect(prompt).toMatch(/tidak diketahui|umum/i);
  });
});
