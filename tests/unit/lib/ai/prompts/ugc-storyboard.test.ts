// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import {
  UGC_STORYBOARD_SYSTEM_PROMPT,
  buildUgcStoryboardPrompt,
} from "@/lib/ai/prompts/ugc-storyboard";

/**
 * Test fixtures for the UGC Storyboard prompt.
 *
 * UGC storyboard = 4-6 panels that break a UGC video into shots. Each
 * panel has time + visuals + audio + text. Output is a JSON ARRAY
 * (one item per panel).
 */
const FULL_PRODUCT = {
  name: "Serum Vitamin C Premium",
  brand: "GlowLab",
  category: "kecantikan",
  target_market: "Wanita 25-35 tahun",
  usp: "Mengandung 20% Vitamin C murni",
  benefits: "Mencerahkan kulit dalam 14 hari",
};

const BASE_INPUT = {
  product: FULL_PRODUCT,
  platform: "tiktok" as const,
  tone: "casual" as const,
};

describe("UGC_STORYBOARD_SYSTEM_PROMPT", () => {
  it("requires output to be valid JSON only", () => {
    expect(UGC_STORYBOARD_SYSTEM_PROMPT).toMatch(/JSON/i);
  });

  it("requires Bahasa Indonesia", () => {
    expect(UGC_STORYBOARD_SYSTEM_PROMPT).toMatch(/Bahasa Indonesia/i);
  });

  it("specifies the storyboard / panel structure", () => {
    // Storyboards are panel/shot-based, so the system prompt must mention
    // panel/scene/storyboard so the model knows to emit 4-6 shots.
    expect(UGC_STORYBOARD_SYSTEM_PROMPT).toMatch(/panel|scene|shot|storyboard/i);
  });

  it("specifies a UGC / casual feel", () => {
    // UGC storyboards are casual (phone-shot, not cinematic), so the
    // system prompt must mention UGC or casual / informal.
    expect(UGC_STORYBOARD_SYSTEM_PROMPT).toMatch(/UGC|casual|informal|testimoni/i);
  });
});

describe("buildUgcStoryboardPrompt", () => {
  it("interpolates the product name, platform, and tone", () => {
    const prompt = buildUgcStoryboardPrompt(BASE_INPUT);
    expect(prompt).toContain(FULL_PRODUCT.name);
    expect(prompt).toContain("tiktok");
    expect(prompt).toContain("casual");
  });

  it("falls back to placeholders when product fields are null", () => {
    const prompt = buildUgcStoryboardPrompt({
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
    });
    expect(prompt).not.toContain("null");
    expect(prompt).toContain("instagram");
    expect(prompt).toContain("professional");
  });

  it("produces different prompts for different platforms", () => {
    const tiktok = buildUgcStoryboardPrompt({
      ...BASE_INPUT,
      platform: "tiktok",
    });
    const instagram = buildUgcStoryboardPrompt({
      ...BASE_INPUT,
      platform: "instagram",
    });
    const youtube = buildUgcStoryboardPrompt({
      ...BASE_INPUT,
      platform: "youtube",
    });
    const facebook = buildUgcStoryboardPrompt({
      ...BASE_INPUT,
      platform: "facebook",
    });

    expect(tiktok).toContain("tiktok");
    expect(instagram).toContain("instagram");
    expect(youtube).toContain("youtube");
    expect(facebook).toContain("facebook");
  });

  it("includes the storyboard JSON output schema (panel, time, visuals, audio, text) in the prompt", () => {
    const prompt = buildUgcStoryboardPrompt(BASE_INPUT);
    // Storyboard output is an array of panel objects, each with
    // panel + time + visuals + audio + text.
    expect(prompt).toContain('"panel"');
    expect(prompt).toContain('"time"');
    expect(prompt).toContain('"visuals"');
    expect(prompt).toContain('"audio"');
    expect(prompt).toContain('"text"');
  });

  it("specifies a 4-6 panel range for UGC videos", () => {
    const prompt = buildUgcStoryboardPrompt(BASE_INPUT);
    // UGC videos are short (15-60s), so 4-6 panels covers the range
    // without making each panel too short or too long.
    expect(prompt).toMatch(/4.{0,5}6|empat.{0,15}enam/i);
  });
});
