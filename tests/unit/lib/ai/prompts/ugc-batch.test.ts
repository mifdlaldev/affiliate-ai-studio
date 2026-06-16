// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import {
  UGC_BATCH_SYSTEM_PROMPT,
  buildUgcBatchPrompt,
} from "@/lib/ai/prompts/ugc-batch";

/**
 * Test fixtures for the UGC Batch prompt.
 *
 * Batch takes MULTIPLE products and produces one UGC script per
 * product, in a single AI call. Input `products` is an array of
 * { name, category, brand } (the action layer is responsible for
 * loading the full product records from Supabase and projecting
 * to this shape before calling the prompt builder).
 */
const PRODUCTS = [
  {
    name: "Serum Vitamin C Premium",
    category: "kecantikan",
    brand: "GlowLab",
  },
  {
    name: "Tas Selempang Kulit",
    category: "fashion",
    brand: "KulitNusantara",
  },
  {
    name: "Kopi Arabica Aceh Gayo",
    category: "minuman",
    brand: "AcehRoastery",
  },
];

const BASE_INPUT = {
  products: PRODUCTS,
  platform: "tiktok" as const,
  tone: "casual" as const,
};

describe("UGC_BATCH_SYSTEM_PROMPT", () => {
  it("requires output to be valid JSON only", () => {
    expect(UGC_BATCH_SYSTEM_PROMPT).toMatch(/JSON/i);
  });

  it("requires Bahasa Indonesia", () => {
    expect(UGC_BATCH_SYSTEM_PROMPT).toMatch(/Bahasa Indonesia/i);
  });

  it("specifies the UGC / testimonial style and 1-script-per-product rule", () => {
    // Batch must produce one UGC script per product. The system prompt
    // must mention UGC/testimonial AND that the output count must
    // match the input product count.
    expect(UGC_BATCH_SYSTEM_PROMPT).toMatch(/UGC|testimoni|review/i);
    expect(UGC_BATCH_SYSTEM_PROMPT).toMatch(/satu|1|tiap|setiap|per product|per produk/i);
  });
});

describe("buildUgcBatchPrompt", () => {
  it("interpolates every product name, platform, and tone", () => {
    const prompt = buildUgcBatchPrompt(BASE_INPUT);
    for (const p of PRODUCTS) {
      expect(prompt).toContain(p.name);
    }
    expect(prompt).toContain("tiktok");
    expect(prompt).toContain("casual");
  });

  it("falls back to placeholders when product fields are null", () => {
    const prompt = buildUgcBatchPrompt({
      products: [
        { name: "Produk X", category: null, brand: null },
        { name: "Produk Y", category: null, brand: null },
      ],
      platform: "instagram",
      tone: "professional",
    });
    expect(prompt).not.toContain("null");
    expect(prompt).toContain("Produk X");
    expect(prompt).toContain("Produk Y");
    expect(prompt).toContain("instagram");
    expect(prompt).toContain("professional");
  });

  it("produces different prompts for different platforms", () => {
    const tiktok = buildUgcBatchPrompt({ ...BASE_INPUT, platform: "tiktok" });
    const instagram = buildUgcBatchPrompt({
      ...BASE_INPUT,
      platform: "instagram",
    });
    const youtube = buildUgcBatchPrompt({
      ...BASE_INPUT,
      platform: "youtube",
    });
    const facebook = buildUgcBatchPrompt({
      ...BASE_INPUT,
      platform: "facebook",
    });

    expect(tiktok).toContain("tiktok");
    expect(instagram).toContain("instagram");
    expect(youtube).toContain("youtube");
    expect(facebook).toContain("facebook");
  });

  it("includes the UGC JSON output schema (title, text) in the prompt", () => {
    const prompt = buildUgcBatchPrompt(BASE_INPUT);
    // Batch output is an array of { title, text } — one per product.
    // The schema must be present so the model knows the shape.
    expect(prompt).toContain('"title"');
    expect(prompt).toContain('"text"');
  });

  it("scales with the number of products", () => {
    const two = buildUgcBatchPrompt({
      products: PRODUCTS.slice(0, 2),
      platform: "tiktok",
      tone: "casual",
    });
    const five = buildUgcBatchPrompt({
      products: [
        ...PRODUCTS,
        { name: "Produk 4", category: "umum", brand: "Brand4" },
        { name: "Produk 5", category: "umum", brand: "Brand5" },
      ],
      platform: "tiktok",
      tone: "casual",
    });

    // More products = more product lines in the prompt.
    expect(five.length).toBeGreaterThan(two.length);
    // Every product name must appear.
    expect(five).toContain("Produk 5");
  });
});
