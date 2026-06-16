import { describe, it, expect } from "vitest";
import type { Asset } from "@/lib/actions/assets";
import { exportAsJson } from "@/lib/export/json";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const arrayResultAsset: Asset = {
  id: "gen-j1",
  module: "caption",
  subtype: "instagram",
  result: [
    { text: "Caption satu", hashtags: ["#tag1"], tips: "Tips" },
  ],
  createdAt: "2026-06-15T12:00:00.000Z",
  previewText: "",
};

const objectResultAsset: Asset = {
  id: "gen-j2",
  module: "competitor",
  subtype: null,
  result: { summary: "Analysis", score: 85 },
  createdAt: "2026-06-15T13:00:00.000Z",
  previewText: "",
};

const stringResultAsset: Asset = {
  id: "gen-j3",
  module: "photo_prompt",
  subtype: null,
  result: "A high-quality product photo on white background",
  createdAt: "2026-06-15T14:00:00.000Z",
  previewText: "",
};

const nullResultAsset: Asset = {
  id: "gen-j4",
  module: "caption",
  subtype: null,
  result: null,
  createdAt: "2026-06-15T15:00:00.000Z",
  previewText: "",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("exportAsJson", () => {
  it("pretty-prints array results with 2-space indent", () => {
    const output = exportAsJson(arrayResultAsset);

    expect(output).toBe(JSON.stringify(arrayResultAsset.result, null, 2));
    // Verify it's actually pretty-printed
    expect(output).toContain("\n");
  });

  it("pretty-prints object results with 2-space indent", () => {
    const output = exportAsJson(objectResultAsset);

    expect(output).toBe(JSON.stringify(objectResultAsset.result, null, 2));
    expect(output).toContain('"summary"');
    expect(output).toContain("85");
  });

  it("returns a JSON string for a primitive string result", () => {
    const output = exportAsJson(stringResultAsset);

    // The string should be wrapped in JSON quotes
    expect(output).toMatch(/^".*"$/);
    expect(output).toBe(JSON.stringify(stringResultAsset.result));
  });

  it("returns 'null' for a null result", () => {
    const output = exportAsJson(nullResultAsset);

    expect(output).toBe("null");
  });
});
