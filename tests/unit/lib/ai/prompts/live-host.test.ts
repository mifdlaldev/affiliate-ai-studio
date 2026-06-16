// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import {
  LIVE_HOST_SYSTEM_PROMPT,
  buildLiveHostPrompt,
} from "@/lib/ai/prompts/live-host";

/**
 * Full product fixture used to drive `buildLiveHostPrompt` with every
 * field populated. Mirrors the shape of a row from the `products` table
 * after the RLS-scoped `select` in `lib/actions/live-host.ts`.
 */
const FULL_PRODUCT = {
  name: "Serum Vitamin C Premium",
  brand: "GlowLab",
  category: "kecantikan",
  target_market: "Wanita 25-35 tahun, peduli skincare anti-aging",
  usp: "Mengandung 20% Vitamin C murni + Niacinamide untuk kulit cerah merata",
  benefits: "Mencerahkan kulit dalam 14 hari\nMengurangi noda hitam\nMelembabkan",
};

describe("LIVE_HOST_SYSTEM_PROMPT", () => {
  it("requires output to be valid JSON only", () => {
    expect(LIVE_HOST_SYSTEM_PROMPT).toMatch(/JSON/i);
  });

  it("requires Bahasa Indonesia", () => {
    expect(LIVE_HOST_SYSTEM_PROMPT).toMatch(/Bahasa Indonesia/i);
  });

  it("mentions the live segment structure (segments, segments, segmentName, hostScript, engagementTip)", () => {
    // Live Host scripts are segment-based (not scene-based) with their
    // own timing labels, so the system prompt must guide the model
    // toward producing the live-specific shape.
    const prompt = LIVE_HOST_SYSTEM_PROMPT.toLowerCase();
    expect(prompt).toMatch(/segment/);
    expect(prompt).toMatch(/hostscript|host script|narasi/);
    expect(prompt).toMatch(/engagementtip|engagement tip|interaksi/);
  });
});

describe("buildLiveHostPrompt", () => {
  it("interpolates the product name, platform, tone, audience, and duration", () => {
    const prompt = buildLiveHostPrompt({
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

  it("uses 'menit' as the unit of duration (not detik/seconds)", () => {
    // Live Host durations are in MINUTES (15/30/60) — not seconds like
    // the Script Generator. The user prompt must reflect that, otherwise
    // the model will calibrate scene counts to the wrong scale.
    const prompt = buildLiveHostPrompt({
      product: FULL_PRODUCT,
      platform: "instagram",
      tone: "professional",
      audience: "umum",
      duration: "30",
    });
    expect(prompt).toMatch(/menit/i);
    expect(prompt).not.toMatch(/detik/i);
  });

  it("replaces null product fields with graceful placeholders (no literal 'null')", () => {
    const prompt = buildLiveHostPrompt({
      product: {
        name: null,
        brand: null,
        category: null,
        target_market: null,
        usp: null,
        benefits: null,
      },
      platform: "tiktok",
      tone: "funny",
      audience: null,
      duration: "15",
    });
    expect(prompt).not.toContain("null");
    expect(prompt).not.toContain("None");
    // Must still contain a usable product reference — the placeholder
    // for name is "Produk ini" in the script prompt family.
    expect(prompt.length).toBeGreaterThan(0);
  });

  it("treats a null audience as 'umum' (general audience)", () => {
    const prompt = buildLiveHostPrompt({
      product: FULL_PRODUCT,
      platform: "tiktok",
      tone: "casual",
      audience: null,
      duration: "30",
    });
    expect(prompt).toContain("umum");
  });

  it("includes the JSON output schema (title, segments, segmentName, hostScript, keyPoints, engagementTip, cta) in the prompt", () => {
    const prompt = buildLiveHostPrompt({
      product: FULL_PRODUCT,
      platform: "tiktok",
      tone: "casual",
      audience: "umum",
      duration: "30",
    });
    expect(prompt).toContain('"title"');
    expect(prompt).toContain('"segments"');
    expect(prompt).toContain('"segmentName"');
    expect(prompt).toContain('"hostScript"');
    expect(prompt).toContain('"keyPoints"');
    expect(prompt).toContain('"engagementTip"');
    expect(prompt).toContain('"cta"');
  });
});
