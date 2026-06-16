import { describe, it, expect } from "vitest";
import type { Asset } from "@/lib/actions/assets";
import { exportAsCsv } from "@/lib/export/csv";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const assets: Asset[] = [
  {
    id: "gen-c1",
    module: "caption",
    subtype: "tiktok",
    result: [{ text: "Caption produk", hashtags: ["#skincare"], tips: "Gunakan emoji" }],
    createdAt: "2026-06-15T08:00:00.000Z",
    previewText: "",
  },
  {
    id: "gen-h1",
    module: "hook",
    subtype: "instagram",
    result: [{ text: "Hook yang menarik", platform: "instagram", tone: "curious" }],
    createdAt: "2026-06-15T09:00:00.000Z",
    previewText: "",
  },
];

const assetWithCommas: Asset = {
  id: "gen-x1",
  module: "caption",
  subtype: "tiktok",
  result: [{ text: "Produk dengan, koma dan \"kutip\"", hashtags: ["#tag"], tips: "Hati-hati" }],
  createdAt: "2026-06-15T10:00:00.000Z",
  previewText: "",
};

const nullSubtypeAsset: Asset = {
  id: "gen-n1",
  module: "competitor",
  subtype: null,
  result: { summary: "Analysis result" },
  createdAt: "2026-06-15T11:00:00.000Z",
  previewText: "",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("exportAsCsv", () => {
  it("returns CSV with header and correct columns", () => {
    const output = exportAsCsv(assets);

    const lines = output.trim().split("\n");
    expect(lines).toHaveLength(3); // header + 2 rows

    const header = lines[0]!;
    expect(header).toBe("module,subtype,created_at,content");

    const firstRow = lines[1]!;
    expect(firstRow).toContain("caption");
    expect(firstRow).toContain("tiktok");
    expect(firstRow).toContain("2026-06-15T08:00:00.000Z");
    expect(firstRow).toContain("Caption produk");

    const secondRow = lines[2]!;
    expect(secondRow).toContain("hook");
    expect(secondRow).toContain("instagram");
    expect(secondRow).toContain("2026-06-15T09:00:00.000Z");
    expect(secondRow).toContain("Hook yang menarik");
  });

  it("escapes commas, quotes and newlines in content", () => {
    const output = exportAsCsv([assetWithCommas]);

    const row = output.trim().split("\n")[1]!;
    // Content has comma and quotes — should be wrapped in double-quotes
    expect(row).toMatch(/"Produk dengan, koma dan ""kutip"""/);
  });

  it("returns only header when assets array is empty", () => {
    const output = exportAsCsv([]);

    expect(output.trim()).toBe("module,subtype,created_at,content");
  });

  it("handles null subtype as empty string", () => {
    const output = exportAsCsv([nullSubtypeAsset]);

    const row = output.trim().split("\n")[1]!;
    // The subtype column should be empty (between two commas after module)
    const columns = row.split(",");
    expect(columns[1]).toBe("");
  });
});
