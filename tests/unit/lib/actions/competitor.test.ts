import { describe, it, expect, vi, beforeEach } from "vitest";

// Module-level mock fns (referenced by the `vi.mock` factory bodies below).
// vitest hoists `vi.mock` above the `const` declarations at runtime, but the
// factory functions are not invoked until the module is first imported — by
// that point these bindings are already initialised, so the reference is safe.
const mockGetUser = vi.fn();
const mockProductSingle = vi.fn();
const mockInsert = vi.fn();
const mockGenerateText = vi.fn();
const mockCheckAndIncrementUsage = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
    from: (table: string) => {
      if (table === "products") {
        return {
          // Competitor analyzer fetches ONE product via
          // .select(...).eq("id", productId).single()
          select: () => ({
            eq: () => ({
              single: () => mockProductSingle(),
            }),
          }),
        };
      }
      if (table === "competitor_analyses") {
        return {
          insert: (data: unknown) => mockInsert(data),
        };
      }
      return {};
    },
  }),
}));

vi.mock("@/lib/ai/client", () => ({
  generateText: (args: unknown) => mockGenerateText(args),
}));

vi.mock("@/lib/usage/limits", () => ({
  checkAndIncrementUsage: (userId: string) =>
    mockCheckAndIncrementUsage(userId),
}));

// ---- Test fixtures ---------------------------------------------------------

const MOCK_USER = { id: "user-303", email: "spy@example.com" };

const MOCK_PRODUCT = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Serum Vitamin C Premium",
  category: "kecantikan",
  brand: "GlowLab",
  price: "Rp 150.000",
  target_market: "wanita 20-35 tahun",
  usp: "Formula 20% vitamin C stabil, no alcohol, no fragrance",
};

// A canonical analysis object — used as the "happy path" AI response.
const MOCK_ANALYSIS = {
  competitorName: "Serum Vitamin C Brand Lain",
  priceRange: "Rp 120.000 - Rp 180.000",
  rating: "4.7",
  strengths: [
    "Harga lebih murah dari produk user",
    "Rating tinggi 4.7 dengan ribuan review",
    "Foto produk profesional multi-angle",
  ],
  weaknesses: [
    "Deskripsi produk minim, tidak jelas benefit",
    "Komposisi tidak ditampilkan detail",
  ],
  contentGaps: [
    "Belum ada konten video before-after",
    "Tutorial cara layering dengan sunscreen belum diliput",
  ],
  recommendations: [
    "Buat konten side-by-side komposisi",
    "Fokus pada angle 'no alcohol' yang user punya",
  ],
  overallAssessment:
    "Kompetitor bermain di harga dan social proof, tapi lemah di edukasi dan transparansi komposisi. User punya peluang besar di konten edukatif.",
};

// ---- FormData helper -------------------------------------------------------

interface FormOverrides {
  productId?: string;
  competitorUrl?: string;
  platform?: string;
}

function makeFormData(overrides: FormOverrides = {}): FormData {
  const fd = new FormData();
  fd.set("productId", overrides.productId ?? MOCK_PRODUCT.id);
  fd.set(
    "competitorUrl",
    overrides.competitorUrl ??
      "https://shopee.co.id/serum-vitamin-c-kompetitor",
  );
  fd.set("platform", overrides.platform ?? "shopee");
  return fd;
}

// ---- Tests -----------------------------------------------------------------

describe("analyzeCompetitor Server Action", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });
    mockCheckAndIncrementUsage.mockResolvedValue({
      allowed: true,
      remaining: 49,
    });
    mockProductSingle.mockResolvedValue({ data: MOCK_PRODUCT, error: null });
    mockInsert.mockResolvedValue({ data: null, error: null });
    mockGenerateText.mockResolvedValue({
      content: JSON.stringify(MOCK_ANALYSIS),
      tokensUsed: 1800,
      durationMs: 4200,
      model: "test-model",
    });
  });

  // 1. Happy path — returns parsed analysis, calls AI in JSON mode
  it("returns parsed competitor analysis on the happy path", async () => {
    const { analyzeCompetitor } = await import("@/lib/actions/competitor");

    const result = await analyzeCompetitor(makeFormData());

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual(MOCK_ANALYSIS);
    // Product must be fetched exactly once via .eq(...).single()
    expect(mockProductSingle).toHaveBeenCalledTimes(1);
    // Model must be called exactly once in JSON mode
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    const callArgs = mockGenerateText.mock.calls[0]?.[0] as {
      jsonMode?: boolean;
      prompt: string;
      systemPrompt?: string;
    };
    expect(callArgs.jsonMode).toBe(true);
    expect(callArgs.systemPrompt).toBeDefined();
    expect(callArgs.prompt).toContain(MOCK_PRODUCT.name);
  });

  // 2. Usage limit reached
  it("returns error when usage limit is reached", async () => {
    mockCheckAndIncrementUsage.mockResolvedValue({
      allowed: false,
      remaining: 0,
    });
    const { analyzeCompetitor } = await import("@/lib/actions/competitor");

    const result = await analyzeCompetitor(makeFormData());

    expect(result.data).toBeUndefined();
    expect(result.error).toMatch(/batas|limit/i);
    // No AI call, no product fetch, no insert
    expect(mockProductSingle).not.toHaveBeenCalled();
    expect(mockGenerateText).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  // 3. Not signed in
  it("returns error when user is not signed in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const { analyzeCompetitor } = await import("@/lib/actions/competitor");

    const result = await analyzeCompetitor(makeFormData());

    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(mockCheckAndIncrementUsage).not.toHaveBeenCalled();
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  // 4. Invalid JSON from AI
  it("returns error when the AI response is not valid JSON", async () => {
    mockGenerateText.mockResolvedValue({
      content: "bukan json { broken",
      tokensUsed: 100,
      durationMs: 500,
      model: "test-model",
    });
    const { analyzeCompetitor } = await import("@/lib/actions/competitor");

    const result = await analyzeCompetitor(makeFormData());

    expect(result.data).toBeUndefined();
    expect(result.error).toMatch(/tidak valid|invalid/i);
    // Insertion must NOT happen when AI output is garbage
    expect(mockInsert).not.toHaveBeenCalled();
  });

  // 5. Product not found
  it("returns error when the selected product is not found", async () => {
    mockProductSingle.mockResolvedValue({
      data: null,
      error: { message: "Row not found" },
    });
    const { analyzeCompetitor } = await import("@/lib/actions/competitor");

    const result = await analyzeCompetitor(makeFormData());

    expect(result.data).toBeUndefined();
    expect(result.error).toMatch(/tidak ditemukan/i);
    expect(mockGenerateText).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  // 6. Zod validation fails (invalid URL)
  it("returns error when Zod validation fails (invalid URL)", async () => {
    const { analyzeCompetitor } = await import("@/lib/actions/competitor");

    const result = await analyzeCompetitor(
      makeFormData({ competitorUrl: "bukan-url" }),
    );

    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(mockProductSingle).not.toHaveBeenCalled();
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  // 7. Saves to competitor_analyses with the right shape (shopee path)
  it("inserts the analysis into competitor_analyses (shopee platform)", async () => {
    const { analyzeCompetitor } = await import("@/lib/actions/competitor");

    const result = await analyzeCompetitor(makeFormData());

    expect(result.error).toBeUndefined();
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const inserted = mockInsert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(inserted.user_id).toBe(MOCK_USER.id);
    expect(inserted.shopee_url).toBe(
      "https://shopee.co.id/serum-vitamin-c-kompetitor",
    );
    expect(inserted.tiktok_url).toBeNull();
    expect(inserted.tokens_used).toBe(1800);
    expect(inserted.analysis_result).toEqual(MOCK_ANALYSIS);
  });

  // 8. Edge case — different platform (tiktok-shop) routes the URL to tiktok_url
  it("inserts the URL into tiktok_url when platform is tiktok-shop", async () => {
    const { analyzeCompetitor } = await import("@/lib/actions/competitor");

    const result = await analyzeCompetitor(
      makeFormData({
        platform: "tiktok-shop",
        competitorUrl: "https://tiktok.com/shop/serum-kompetitor",
      }),
    );

    expect(result.error).toBeUndefined();
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const inserted = mockInsert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(inserted.shopee_url).toBeNull();
    expect(inserted.tiktok_url).toBe(
      "https://tiktok.com/shop/serum-kompetitor",
    );
    expect(inserted.analysis_result).toEqual(MOCK_ANALYSIS);
    expect(inserted.tokens_used).toBe(1800);
  });
});
