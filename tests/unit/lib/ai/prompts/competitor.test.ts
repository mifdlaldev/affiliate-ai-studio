// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import {
  COMPETITOR_SYSTEM_PROMPT,
  buildCompetitorPrompt,
} from "@/lib/ai/prompts/competitor";

/**
 * Test fixtures for the Competitor Analyzer prompt.
 *
 * The flow takes the user's own product (full record) and a competitor
 * URL to fetch & analyze, plus the platform that competitor URL lives on
 * (so the model knows which marketplace's listing format to expect).
 */

const FULL_PRODUCT = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Serum Vitamin C Premium",
  category: "kecantikan",
  brand: "GlowLab",
  price: "Rp 150.000 - Rp 250.000",
  target_market: "Wanita usia 20-35 tahun yang peduli skincare",
  usp: "Formula vitamin C 20% stabil dengan niacinamide untuk brightening cepat tanpa iritasi",
};

const NULLABLE_PRODUCT = {
  id: "22222222-2222-2222-2222-222222222222",
  name: "Tas Selempang Kulit",
  category: null,
  brand: null,
  price: null,
  target_market: null,
  usp: null,
};

const BASE_INPUT = {
  product: FULL_PRODUCT,
  competitorUrl: "https://shopee.co.id/competitor-serum-vitc-vitamin-c-20pct",
  platform: "shopee" as const,
};

describe("COMPETITOR_SYSTEM_PROMPT", () => {
  it("contains the required keywords (JSON, competitor, analisis/analysis)", () => {
    // The system prompt must mention JSON output format, the competitor
    // domain, and an analysis verb in Indonesian so the model knows to
    // emit a structured competitive-analysis report.
    expect(COMPETITOR_SYSTEM_PROMPT).toMatch(/JSON/i);
    expect(COMPETITOR_SYSTEM_PROMPT).toMatch(/kompetitor|competitor/i);
    expect(COMPETITOR_SYSTEM_PROMPT).toMatch(/analisis|analysis/i);
  });

  it("specifies the JSON output schema fields (competitorName, priceRange, rating, strengths, weaknesses, contentGaps, recommendations, overallAssessment)", () => {
    // The system prompt must show the model the exact JSON shape
    // expected back so it doesn't guess field names.
    expect(COMPETITOR_SYSTEM_PROMPT).toContain("competitorName");
    expect(COMPETITOR_SYSTEM_PROMPT).toContain("priceRange");
    expect(COMPETITOR_SYSTEM_PROMPT).toContain("rating");
    expect(COMPETITOR_SYSTEM_PROMPT).toContain("strengths");
    expect(COMPETITOR_SYSTEM_PROMPT).toContain("weaknesses");
    expect(COMPETITOR_SYSTEM_PROMPT).toContain("contentGaps");
    expect(COMPETITOR_SYSTEM_PROMPT).toContain("recommendations");
    expect(COMPETITOR_SYSTEM_PROMPT).toContain("overallAssessment");
  });
});

describe("buildCompetitorPrompt", () => {
  it("includes the product name (echoed for the model)", () => {
    const prompt = buildCompetitorPrompt(BASE_INPUT);
    // The user prompt must echo the user's product name so the model
    // can frame the competitive analysis in the right product category.
    expect(prompt).toContain(FULL_PRODUCT.name);
  });

  it("includes the competitor URL", () => {
    const prompt = buildCompetitorPrompt(BASE_INPUT);
    // The user prompt must include the competitor URL verbatim so the
    // model can reason about the actual listing the user is asking
    // about (the model may or may not fetch it depending on capability,
    // but the URL must be present in context).
    expect(prompt).toContain(BASE_INPUT.competitorUrl);
  });

  it("includes the platform (shopee, tokopedia, tiktok-shop, lazada)", () => {
    const prompt = buildCompetitorPrompt(BASE_INPUT);
    // The user prompt must echo the platform so the model knows which
    // marketplace's listing format to expect (Shopee seller notes differ
    // from Tokopedia, etc.).
    expect(prompt).toContain("shopee");
  });

  it("handles null product fields gracefully (category, brand, price, target_market, usp)", () => {
    // The user prompt must never leak the literal string "null" into
    // the model's context. Null fields should be replaced with a
    // placeholder (similar to calendar's valueOrPlaceholder pattern).
    const prompt = buildCompetitorPrompt({
      product: NULLABLE_PRODUCT,
      competitorUrl: "https://www.tokopedia.com/competitor-tas-kulit",
      platform: "tokopedia",
    });

    // The product name must still be present even when other fields are null.
    expect(prompt).toContain(NULLABLE_PRODUCT.name);

    // The literal "null" must not appear in the prompt body.
    expect(prompt.toLowerCase()).not.toContain("null");
  });

  it("interpolates the platform value for all four supported marketplaces (shopee, tokopedia, tiktok-shop, lazada)", () => {
    // The user prompt must echo the platform parameter verbatim so the
    // model can tailor the analysis to marketplace-specific context
    // (e.g. TikTok Shop has UGC-heavy content, Lazada has coupon stacks,
    // Shopee has flash sales, Tokopedia has official store badges).
    const shopee = buildCompetitorPrompt({
      ...BASE_INPUT,
      platform: "shopee",
    });
    const tokopedia = buildCompetitorPrompt({
      ...BASE_INPUT,
      platform: "tokopedia",
    });
    const tiktokShop = buildCompetitorPrompt({
      ...BASE_INPUT,
      platform: "tiktok-shop",
    });
    const lazada = buildCompetitorPrompt({
      ...BASE_INPUT,
      platform: "lazada",
    });

    expect(shopee).toContain("shopee");
    expect(tokopedia).toContain("tokopedia");
    expect(tiktokShop).toContain("tiktok-shop");
    expect(lazada).toContain("lazada");
  });

  it("includes the full JSON output schema fields in the user prompt", () => {
    // The user prompt must show the model the exact JSON shape expected
    // back: an object with competitorName + priceRange + rating +
    // strengths + weaknesses + contentGaps + recommendations +
    // overallAssessment.
    const prompt = buildCompetitorPrompt(BASE_INPUT);
    expect(prompt).toContain('"competitorName"');
    expect(prompt).toContain('"priceRange"');
    expect(prompt).toContain('"rating"');
    expect(prompt).toContain('"strengths"');
    expect(prompt).toContain('"weaknesses"');
    expect(prompt).toContain('"contentGaps"');
    expect(prompt).toContain('"recommendations"');
    expect(prompt).toContain('"overallAssessment"');
  });
});
