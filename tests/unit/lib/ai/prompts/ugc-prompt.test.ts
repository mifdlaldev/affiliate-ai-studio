// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import {
  UGC_PROMPT_SYSTEM_PROMPT,
  buildUgcPrompt,
} from "@/lib/ai/prompts/ugc-prompt";

/**
 * Test fixtures for the UGC Prompt (image) generator.
 *
 * Output is a JSON ARRAY of { title, prompt, style, mood } objects.
 * Each "prompt" is a Midjourney/Stable Diffusion-style prompt that
 * looks like a phone photo (casual, realistic, user-generated).
 */
const FULL_PRODUCT = {
  name: "Serum Vitamin C Premium",
  brand: "GlowLab",
  category: "kecantikan",
  benefits: "Mencerahkan kulit dalam 14 hari, mengurangi noda hitam",
  usp: "20% Vitamin C murni + Niacinamide",
};

const BASE_INPUT = {
  product: FULL_PRODUCT,
  style: "selfie" as const,
  mood: "happy" as const,
};

describe("UGC_PROMPT_SYSTEM_PROMPT", () => {
  it("requires output to be valid JSON only", () => {
    expect(UGC_PROMPT_SYSTEM_PROMPT).toMatch(/JSON/i);
  });

  it("specifies a UGC / phone-photo / realistic style", () => {
    // The prompt generator emits image-prompt text that looks like
    // a phone photo (UGC). System prompt must mention this so the
    // model emits realistic, casual, hand-held-style descriptions.
    expect(UGC_PROMPT_SYSTEM_PROMPT).toMatch(/UGC|phone|handheld|casual|realistic|testimoni/i);
  });

  it("requires prompts in English for image-generation tools", () => {
    // Image generators (Midjourney/SD) understand English best, so
    // the system prompt should mandate English for the generated
    // "prompt" field even when the product context is Indonesian.
    expect(UGC_PROMPT_SYSTEM_PROMPT).toMatch(/English/i);
  });
});

describe("buildUgcPrompt", () => {
  it("interpolates the product name, style, and mood", () => {
    const prompt = buildUgcPrompt(BASE_INPUT);
    expect(prompt).toContain(FULL_PRODUCT.name);
    expect(prompt).toContain("selfie");
    expect(prompt).toContain("happy");
  });

  it("falls back to placeholders when product fields are null", () => {
    const prompt = buildUgcPrompt({
      product: {
        name: null,
        brand: null,
        category: null,
        benefits: null,
        usp: null,
      },
      style: "lifestyle",
      mood: "casual",
    });
    expect(prompt).not.toContain("null");
    expect(prompt).toContain("lifestyle");
    expect(prompt).toContain("casual");
  });

  it("produces different prompts for different style/mood combinations", () => {
    const selfie = buildUgcPrompt({ ...BASE_INPUT, style: "selfie" });
    const unboxing = buildUgcPrompt({ ...BASE_INPUT, style: "unboxing" });
    const testimonial = buildUgcPrompt({
      ...BASE_INPUT,
      style: "testimonial",
    });
    const excited = buildUgcPrompt({ ...BASE_INPUT, mood: "excited" });
    const satisfied = buildUgcPrompt({ ...BASE_INPUT, mood: "satisfied" });

    expect(selfie).toContain("selfie");
    expect(unboxing).toContain("unboxing");
    expect(testimonial).toContain("testimonial");
    expect(excited).toContain("excited");
    expect(satisfied).toContain("satisfied");
  });

  it("includes the UGC image-prompt JSON output schema (title, prompt, style, mood) in the prompt", () => {
    const prompt = buildUgcPrompt(BASE_INPUT);
    // Image-prompt output is an array of { title, prompt, style, mood }.
    // title = Bahasa Indonesia caption title; prompt = English image-gen prompt.
    expect(prompt).toContain('"title"');
    expect(prompt).toContain('"prompt"');
    expect(prompt).toContain('"style"');
    expect(prompt).toContain('"mood"');
  });
});
