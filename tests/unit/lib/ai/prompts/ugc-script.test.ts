// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import {
  UGC_SCRIPT_SYSTEM_PROMPT,
  buildUgcScriptPrompt,
} from "@/lib/ai/prompts/ugc-script";

/**
 * Test fixtures for the UGC Script prompt.
 *
 * UGC = User-Generated Content. This is shorter than the regular
 * Script Generator — a single short testimonial/review, not a full
 * scene-by-scene storyboard. Output shape is `{ title, text }`.
 */
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
  platform: "tiktok" as const,
  tone: "casual" as const,
  audience: "mahasiswi 20-25 tahun",
};

describe("UGC_SCRIPT_SYSTEM_PROMPT", () => {
  it("requires output to be valid JSON only", () => {
    expect(UGC_SCRIPT_SYSTEM_PROMPT).toMatch(/JSON/i);
  });

  it("requires Bahasa Indonesia", () => {
    expect(UGC_SCRIPT_SYSTEM_PROMPT).toMatch(/Bahasa Indonesia/i);
  });

  it("specifies the UGC / testimonial / review style", () => {
    // UGC = user-generated content. The system prompt must mention
    // UGC, testimonial, or review so the model knows to emit a
    // casual first-person voice, not a polished ad script.
    expect(UGC_SCRIPT_SYSTEM_PROMPT).toMatch(/UGC|testimoni|review|reviewer/i);
  });
});

describe("buildUgcScriptPrompt", () => {
  it("interpolates the product name, platform, tone, and audience", () => {
    const prompt = buildUgcScriptPrompt(BASE_INPUT);
    expect(prompt).toContain(FULL_PRODUCT.name);
    expect(prompt).toContain("tiktok");
    expect(prompt).toContain("casual");
    expect(prompt).toContain("mahasiswi 20-25 tahun");
  });

  it("falls back to placeholders when product fields are null", () => {
    const prompt = buildUgcScriptPrompt({
      product: {
        name: null,
        brand: null,
        category: null,
        target_market: null,
        usp: null,
        benefits: null,
      },
      platform: "instagram",
      tone: "professional",
      audience: null,
    });
    // The model must not be told to use literal "null" — it should fall
    // back to "umum" / empty string placeholders.
    expect(prompt).not.toContain("null");
    // Should still contain platform + tone.
    expect(prompt).toContain("instagram");
    expect(prompt).toContain("professional");
  });

  it("handles null audience with a sensible default", () => {
    const prompt = buildUgcScriptPrompt({
      product: FULL_PRODUCT,
      platform: "youtube",
      tone: "inspirational",
      audience: null,
    });
    // Audience is optional; the prompt must contain a fallback (e.g. "umum")
    // instead of an empty placeholder.
    expect(prompt).toContain("umum");
  });

  it("produces different prompts for different platforms", () => {
    const tiktok = buildUgcScriptPrompt({ ...BASE_INPUT, platform: "tiktok" });
    const instagram = buildUgcScriptPrompt({
      ...BASE_INPUT,
      platform: "instagram",
    });
    const youtube = buildUgcScriptPrompt({
      ...BASE_INPUT,
      platform: "youtube",
    });
    const facebook = buildUgcScriptPrompt({
      ...BASE_INPUT,
      platform: "facebook",
    });

    expect(tiktok).toContain("tiktok");
    expect(instagram).toContain("instagram");
    expect(youtube).toContain("youtube");
    expect(facebook).toContain("facebook");
  });

  it("includes the UGC JSON output schema (title, text) in the prompt", () => {
    const prompt = buildUgcScriptPrompt(BASE_INPUT);
    // UGC output is a single object with `title` + `text` (not an array
    // of storyboard scenes). The user prompt must show the model the
    // exact JSON shape expected back.
    expect(prompt).toContain('"title"');
    expect(prompt).toContain('"text"');
    // UGC must NOT include the storyboard-specific scene fields.
    expect(prompt).not.toContain('"scenes"');
    expect(prompt).not.toContain('"visuals"');
  });
});
