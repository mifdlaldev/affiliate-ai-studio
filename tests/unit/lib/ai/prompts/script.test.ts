// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import {
  SCRIPT_SYSTEM_PROMPT,
  buildScriptPrompt,
} from "@/lib/ai/prompts/script";

const FULL_PRODUCT = {
  name: "Serum Vitamin C Premium",
  brand: "GlowLab",
  category: "kecantikan",
  target_market: "Wanita 25-35 tahun, peduli skincare anti-aging",
  usp: "Mengandung 20% Vitamin C murni + Niacinamide untuk kulit cerah merata",
  benefits: "Mencerahkan kulit dalam 14 hari\nMengurangi noda hitam\nMelembabkan",
};

describe("SCRIPT_SYSTEM_PROMPT", () => {
  it("requires output to be valid JSON only", () => {
    expect(SCRIPT_SYSTEM_PROMPT).toMatch(/JSON/i);
  });

  it("requires Bahasa Indonesia", () => {
    expect(SCRIPT_SYSTEM_PROMPT).toMatch(/Bahasa Indonesia/i);
  });

  it("mentions the script structure (scenes or duration)", () => {
    // Scripts are scene-based with timing, so system prompt must mention
    // scene / durasi / detik to guide the model.
    expect(SCRIPT_SYSTEM_PROMPT).toMatch(/scene|durasi|detik|script/i);
  });
});

describe("buildScriptPrompt", () => {
  it("interpolates the product name, platform, tone, audience, and duration", () => {
    const prompt = buildScriptPrompt({
      product: FULL_PRODUCT,
      platform: "tiktok",
      tone: "casual",
      audience: "mahasiswi",
      duration: "30",
    });
    expect(prompt).toContain(FULL_PRODUCT.name);
    expect(prompt).toContain("tiktok");
    expect(prompt).toContain("casual");
    expect(prompt).toContain("mahasiswi");
    expect(prompt).toContain("30");
  });

  it("handles null product fields gracefully (does not write literal 'null')", () => {
    const prompt = buildScriptPrompt({
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
      duration: "60",
    });
    // The model must not be told to use literal "null" — it should fall
    // back to "umum" / empty string placeholders.
    expect(prompt).not.toContain("null");
    // Should still contain platform/tone/duration.
    expect(prompt).toContain("instagram");
    expect(prompt).toContain("professional");
    expect(prompt).toContain("60");
  });

  it("handles null audience with a sensible default", () => {
    const prompt = buildScriptPrompt({
      product: FULL_PRODUCT,
      platform: "youtube",
      tone: "inspirational",
      audience: null,
      duration: "15",
    });
    // Audience is optional; the prompt must contain a fallback (e.g. "umum")
    // instead of an empty placeholder.
    expect(prompt).toContain("umum");
  });

  it("produces different prompts for different platforms", () => {
    const tiktok = buildScriptPrompt({
      product: FULL_PRODUCT,
      platform: "tiktok",
      tone: "casual",
      audience: "umum",
      duration: "30",
    });
    const instagram = buildScriptPrompt({
      product: FULL_PRODUCT,
      platform: "instagram",
      tone: "casual",
      audience: "umum",
      duration: "30",
    });
    const youtube = buildScriptPrompt({
      product: FULL_PRODUCT,
      platform: "youtube",
      tone: "casual",
      audience: "umum",
      duration: "30",
    });
    expect(tiktok).not.toBe(instagram);
    expect(instagram).not.toBe(youtube);
    expect(tiktok).not.toBe(youtube);
  });

  it("includes the JSON output schema (title, scenes, cta) in the prompt", () => {
    const prompt = buildScriptPrompt({
      product: FULL_PRODUCT,
      platform: "tiktok",
      tone: "casual",
      audience: "umum",
      duration: "30",
    });
    expect(prompt).toContain('"title"');
    expect(prompt).toContain('"scenes"');
    expect(prompt).toContain('"time"');
    expect(prompt).toContain('"visuals"');
    expect(prompt).toContain('"audio"');
    expect(prompt).toContain('"text"');
    expect(prompt).toContain('"cta"');
  });
});
