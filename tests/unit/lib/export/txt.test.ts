import { describe, it, expect } from "vitest";
import type { Asset } from "@/lib/actions/assets";
import { exportAsTxt } from "@/lib/export/txt";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const captionAsset: Asset = {
  id: "gen-c1",
  module: "caption",
  subtype: "tiktok",
  result: [
    { text: "Produk ini benar-benar mengubah rutinitas skincare saya!", hashtags: ["#skincare", "#glowing"], tips: "Gunakan emoji wajah berseri" },
    { text: "Review jujur setelah 2 minggu pakai produk ini", hashtags: ["#review", "#skincareindonesia"], tips: "Tone santai" },
  ],
  createdAt: "2026-06-15T08:00:00.000Z",
  previewText: "",
};

const hookAsset: Asset = {
  id: "gen-h1",
  module: "hook",
  subtype: "instagram",
  result: [
    { text: "Berhenti beli skincare mahal sebelum nonton ini!", platform: "instagram", tone: "curious" },
    { text: "3 bahan skincare yang bikin jerawatan makin parah", platform: "instagram", tone: "educational", note: "Gunakan visual close-up" },
  ],
  createdAt: "2026-06-15T09:00:00.000Z",
  previewText: "",
};

const scriptAsset: Asset = {
  id: "gen-s1",
  module: "script",
  subtype: "tiktok",
  result: [
    {
      title: "Unboxing Produk Skincare",
      scenes: [
        { time: "0:00-0:05", visuals: "Close-up produk", audio: "Music upbeat", text: "Halo guys!" },
        { time: "0:05-0:15", visuals: "Tampilkan kemasan", audio: "Sound efek", text: "Langsung kita buka" },
      ],
      cta: "Follow untuk review selanjutnya",
    },
  ],
  createdAt: "2026-06-15T10:00:00.000Z",
  previewText: "",
};

const unknownAsset: Asset = {
  id: "gen-u1",
  module: "calendar",
  subtype: "monthly",
  result: { plan: "Content plan for June", posts: 30, focus: "skincare" },
  createdAt: "2026-06-15T11:00:00.000Z",
  previewText: "",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("exportAsTxt", () => {
  it("formats caption module with text, hashtags and tips", () => {
    const output = exportAsTxt(captionAsset);

    expect(output).toContain("Produk ini benar-benar mengubah rutinitas skincare saya!");
    expect(output).toContain("#skincare #glowing");
    expect(output).toContain("Review jujur setelah 2 minggu pakai produk ini");
    expect(output).toContain("#review #skincareindonesia");
  });

  it("formats hook module with text, platform, tone and optional note", () => {
    const output = exportAsTxt(hookAsset);

    expect(output).toContain("Berhenti beli skincare mahal sebelum nonton ini!");
    expect(output).toContain("Platform: instagram");
    expect(output).toContain("Tone: curious");
    expect(output).toContain("3 bahan skincare yang bikin jerawatan makin parah");
    expect(output).toContain("Note: Gunakan visual close-up");
  });

  it("formats script module with title, scenes and CTA", () => {
    const output = exportAsTxt(scriptAsset);

    expect(output).toContain("Unboxing Produk Skincare");
    expect(output).toContain("0:00-0:05");
    expect(output).toContain("Close-up produk");
    expect(output).toContain("Halo guys!");
    expect(output).toContain("Follow untuk review selanjutnya");
  });

  it("falls back to JSON.stringify for unknown module types", () => {
    const output = exportAsTxt(unknownAsset);

    expect(output).toContain("Content plan for June");
    expect(output).toContain("30");
    // Should be valid JSON pretty-printed
    expect(() => JSON.parse(output)).not.toThrow();
  });
});
