import { describe, it, expect } from "vitest";
import { AI_CONFIG, getNextProvider } from "@/lib/ai/config";

describe("AI_CONFIG", () => {
  it("has a primary provider configured", () => {
    expect(AI_CONFIG.primary).toBeDefined();
    expect(AI_CONFIG.primary.baseURL).toBeTruthy();
    expect(AI_CONFIG.primary.model).toBe("deepseek-v4-flash-free");
  });

  it("primary provider has expected defaults", () => {
    expect(AI_CONFIG.primary.baseURL).toBe("https://opencode.ai/zen/v1");
    expect(AI_CONFIG.primary.reasoning).toBe("max");
    expect(AI_CONFIG.primary.cost).toBe("FREE");
  });

  it("has at least one fallback provider", () => {
    expect(AI_CONFIG.fallbacks.length).toBeGreaterThan(0);
  });

  it("fallback providers have unique names", () => {
    const names = AI_CONFIG.fallbacks.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("getNextProvider", () => {
  it("returns first fallback when current is primary", () => {
    const next = getNextProvider(AI_CONFIG.primary.name);
    expect(next).toBe(AI_CONFIG.fallbacks[0]);
  });

  it("returns the next fallback when current is a fallback", () => {
    if (AI_CONFIG.fallbacks.length >= 2) {
      const current = AI_CONFIG.fallbacks[0];
      const expected = AI_CONFIG.fallbacks[1];
      const next = getNextProvider(current.name);
      expect(next).toBe(expected);
    }
  });

  it("returns null when no more fallbacks", () => {
    const lastFallback = AI_CONFIG.fallbacks[AI_CONFIG.fallbacks.length - 1];
    if (lastFallback) {
      expect(getNextProvider(lastFallback.name)).toBeNull();
    }
  });

  it("returns first fallback for unknown provider name", () => {
    // Unknown names should still hand back something useful so callers can
    // attempt recovery rather than silently giving up.
    const next = getNextProvider("Definitely Not A Real Provider");
    expect(next).toBe(AI_CONFIG.fallbacks[0]);
  });
});
