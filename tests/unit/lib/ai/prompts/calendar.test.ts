// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import {
  CALENDAR_SYSTEM_PROMPT,
  buildCalendarPrompt,
} from "@/lib/ai/prompts/calendar";

const PRODUCTS = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Serum Vitamin C Premium",
    category: "kecantikan",
    brand: "GlowLab",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    name: "Tas Selempang Kulit",
    category: "fashion",
    brand: "KulitNusantara",
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    name: "Kopi Arabica Aceh Gayo",
    category: "minuman",
    brand: "AcehRoastery",
  },
];

const BASE_INPUT = {
  products: PRODUCTS,
  month: 7,
  year: 2026,
  contentTypes: ["photo", "video", "carousel", "reel", "story"],
  platform: "mixed" as const,
  tone: "casual" as const,
};

describe("CALENDAR_SYSTEM_PROMPT", () => {
  it("contains the required keywords (JSON, calendar/day, content)", () => {
    // The system prompt must mention JSON output format, calendar/day
    // domain, and content structure. Calendar generators always emit a
    // day-by-day list, so the system prompt must mention both.
    expect(CALENDAR_SYSTEM_PROMPT).toMatch(/JSON/i);
    expect(CALENDAR_SYSTEM_PROMPT).toMatch(/calendar|kalender|day|hari/i);
    expect(CALENDAR_SYSTEM_PROMPT).toMatch(/content|konten/i);
  });

  it("specifies the 28-31 day output range", () => {
    // A month has 28-31 days, so the system prompt must instruct the
    // model to emit one item per day in that range.
    expect(CALENDAR_SYSTEM_PROMPT).toMatch(/28|31/);
  });
});

describe("buildCalendarPrompt", () => {
  it("includes every product name from the products array", () => {
    const prompt = buildCalendarPrompt(BASE_INPUT);
    for (const product of PRODUCTS) {
      expect(prompt).toContain(product.name);
    }
  });

  it("interpolates the month and year", () => {
    const prompt = buildCalendarPrompt({
      ...BASE_INPUT,
      month: 12,
      year: 2026,
    });
    expect(prompt).toContain("12");
    expect(prompt).toContain("2026");
  });

  it("interpolates all content types from the array", () => {
    const prompt = buildCalendarPrompt({
      ...BASE_INPUT,
      contentTypes: ["photo", "video", "carousel"],
    });
    expect(prompt).toContain("photo");
    expect(prompt).toContain("video");
    expect(prompt).toContain("carousel");
  });

  it("handles different platforms (tiktok vs instagram vs youtube)", () => {
    const tiktok = buildCalendarPrompt({ ...BASE_INPUT, platform: "tiktok" });
    const instagram = buildCalendarPrompt({
      ...BASE_INPUT,
      platform: "instagram",
    });
    const youtube = buildCalendarPrompt({ ...BASE_INPUT, platform: "youtube" });

    // The user prompt must echo the platform parameter so the model can
    // tailor the calendar to platform-specific format expectations.
    expect(tiktok).toContain("tiktok");
    expect(instagram).toContain("instagram");
    expect(youtube).toContain("youtube");
  });

  it("interpolates the tone parameter", () => {
    const prompt = buildCalendarPrompt({ ...BASE_INPUT, tone: "professional" });
    expect(prompt).toContain("professional");
  });

  it("produces different output for different inputs (tone variation)", () => {
    const casual = buildCalendarPrompt({ ...BASE_INPUT, tone: "casual" });
    const professional = buildCalendarPrompt({
      ...BASE_INPUT,
      tone: "professional",
    });
    // Same products + same month/year, only tone changes. The two
    // prompts must differ (tone-specific guidance appears).
    expect(casual).not.toBe(professional);
    expect(casual).toContain("casual");
    expect(professional).toContain("professional");
  });

  it("includes the JSON output schema fields (day, productId, contentType, platform, topic, hook)", () => {
    const prompt = buildCalendarPrompt(BASE_INPUT);
    // The user prompt must show the model the exact JSON shape expected
    // back: a per-day array of objects with day + productId + contentType
    // + platform + topic + hook fields.
    expect(prompt).toContain('"day"');
    expect(prompt).toContain('"productId"');
    expect(prompt).toContain('"productName"');
    expect(prompt).toContain('"contentType"');
    expect(prompt).toContain('"platform"');
    expect(prompt).toContain('"topic"');
    expect(prompt).toContain('"hook"');
  });
});
