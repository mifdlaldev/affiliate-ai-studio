// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import {
  STORYBOARD_SYSTEM_PROMPT,
  buildStoryboardPrompt,
} from "@/lib/ai/prompts/storyboard";

/**
 * Test fixtures for the Storyboard prompt.
 *
 * Storyboard = 6-8 panels that break a short video (15-60s) into
 * shots, each with cinematographic metadata: time, visuals, audio,
 * text overlay, camera angle, transition. Output is a JSON ARRAY
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
  duration: "30" as const,
};

describe("STORYBOARD_SYSTEM_PROMPT", () => {
  it("requires output to be valid JSON only", () => {
    expect(STORYBOARD_SYSTEM_PROMPT).toMatch(/JSON/i);
  });

  it("requires Bahasa Indonesia", () => {
    expect(STORYBOARD_SYSTEM_PROMPT).toMatch(/Bahasa Indonesia/i);
  });

  it("specifies the storyboard / panel structure with 6-8 panels", () => {
    // Storyboards are shot/panel-based, so the system prompt must mention
    // panel/storyboard AND specify the 6-8 range.
    expect(STORYBOARD_SYSTEM_PROMPT).toMatch(/panel|scene|shot|storyboard/i);
    expect(STORYBOARD_SYSTEM_PROMPT).toMatch(/6.{0,5}8|enam.{0,15}delapan/i);
  });

  it("specifies cinematographic fields (camera angle, transition)", () => {
    // Storyboard is a pro tool — must include camera angle and
    // transition guidance so the model emits those fields.
    expect(STORYBOARD_SYSTEM_PROMPT).toMatch(/camera angle|kamera/i);
    expect(STORYBOARD_SYSTEM_PROMPT).toMatch(/transisi|transition/i);
  });
});

describe("buildStoryboardPrompt", () => {
  it("interpolates product name, platform, tone, and duration", () => {
    const prompt = buildStoryboardPrompt(BASE_INPUT);
    expect(prompt).toContain(FULL_PRODUCT.name);
    expect(prompt).toContain("tiktok");
    expect(prompt).toContain("casual");
    expect(prompt).toContain("30");
  });

  it("replaces null product fields with sensible placeholders (never 'null')", () => {
    const prompt = buildStoryboardPrompt({
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
      duration: "60",
    });
    // The model must never see the literal "null".
    expect(prompt).not.toContain("null");
    // Should still contain platform/tone/duration.
    expect(prompt).toContain("instagram");
    expect(prompt).toContain("professional");
    expect(prompt).toContain("60");
  });

  it("includes the JSON output schema (panel, time, visuals, audio, text, cameraAngle, transition)", () => {
    const prompt = buildStoryboardPrompt(BASE_INPUT);
    // Storyboard output is an array of panel objects with 7 fields.
    expect(prompt).toContain('"panel"');
    expect(prompt).toContain('"time"');
    expect(prompt).toContain('"visuals"');
    expect(prompt).toContain('"audio"');
    expect(prompt).toContain('"text"');
    expect(prompt).toContain('"cameraAngle"');
    expect(prompt).toContain('"transition"');
  });

  it("specifies a 6-8 panel range that fits the chosen duration", () => {
    const prompt15 = buildStoryboardPrompt({ ...BASE_INPUT, duration: "15" });
    const prompt60 = buildStoryboardPrompt({ ...BASE_INPUT, duration: "60" });
    // Both 15s and 60s storyboards should land in the 6-8 panel range.
    expect(prompt15).toMatch(/6.{0,5}8|6.{0,5}panel/i);
    expect(prompt60).toMatch(/6.{0,5}8|6.{0,5}panel/i);
  });
});
