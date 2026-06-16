// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import {
  MODEL_SYSTEM_PROMPT,
  buildModelPrompt,
} from "@/lib/ai/prompts/model";

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
  gender: "wanita" as const,
  age: "dewasa" as const,
  modelVibe: "elegan" as const,
};

describe("MODEL_SYSTEM_PROMPT", () => {
  it("contains the required keywords (JSON, model/prompt, English/Bahasa Inggris)", () => {
    // The system prompt must mention: JSON output format, model/prompt
    // domain, and the English language requirement (for the visual
    // prompt field). Matches both "English" and the Indonesian
    // "Bahasa Inggris" since the system prompt itself is in Indonesian.
    expect(MODEL_SYSTEM_PROMPT).toMatch(/JSON/i);
    expect(MODEL_SYSTEM_PROMPT).toMatch(/model|prompt/i);
    expect(MODEL_SYSTEM_PROMPT).toMatch(/Bahasa Inggris|English/i);
  });

  it("includes the modelDescription field in the output schema", () => {
    // Model prompts are unique because they describe a person (the model)
    // alongside the product. The output schema must include a
    // `modelDescription` field for that.
    expect(MODEL_SYSTEM_PROMPT).toMatch(/modelDescription/);
  });
});

describe("buildModelPrompt", () => {
  it("includes the product name", () => {
    const prompt = buildModelPrompt(BASE_INPUT);
    expect(prompt).toContain(FULL_PRODUCT.name);
  });

  it("includes the gender parameter (pria/wanita/any)", () => {
    const prompt = buildModelPrompt({ ...BASE_INPUT, gender: "pria" });
    expect(prompt).toContain("pria");
  });

  it("includes the age parameter (remaja/dewasa/paruh baya/lansia)", () => {
    const prompt = buildModelPrompt({ ...BASE_INPUT, age: "paruh baya" });
    expect(prompt).toContain("paruh baya");
  });

  it("includes the modelVibe parameter (casual/elegan/atletik/profesional)", () => {
    const prompt = buildModelPrompt({ ...BASE_INPUT, modelVibe: "atletik" });
    expect(prompt).toContain("atletik");
  });

  it("includes the style parameter", () => {
    const prompt = buildModelPrompt({ ...BASE_INPUT, style: "creative" });
    expect(prompt).toContain("creative");
  });

  it("handles null product fields gracefully (no literal 'null' in output)", () => {
    const emptyProduct = {
      name: null,
      brand: null,
      category: null,
      target_market: null,
      usp: null,
      benefits: null,
    };
    const prompt = buildModelPrompt({ ...BASE_INPUT, product: emptyProduct });
    // The literal word "null" must not appear — the function should
    // substitute placeholders for missing fields.
    expect(prompt).not.toMatch(/\bnull\b/);
  });

  it("produces different prompts for different styles", () => {
    const minimalist = buildModelPrompt({
      ...BASE_INPUT,
      style: "minimalist",
    });
    const professional = buildModelPrompt({
      ...BASE_INPUT,
      style: "professional",
    });
    // Same product + same model/setting/composition, only style changes.
    // The two prompts must differ (style-specific guidance appears).
    expect(minimalist).not.toBe(professional);
    expect(minimalist).toContain("minimalist");
    expect(professional).toContain("professional");
  });

  it("includes model-specific guidance referencing the modelDescription field", () => {
    // The user prompt must tell the model to produce a modelDescription
    // string (e.g. "Indonesian woman in her 30s, elegant pose...") that
    // covers gender, age, vibe, and pose.
    const prompt = buildModelPrompt(BASE_INPUT);
    expect(prompt).toMatch(/modelDescription|model description/i);
  });
});
