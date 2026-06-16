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
          select: () => ({
            eq: () => ({
              single: () => mockProductSingle(),
            }),
          }),
        };
      }
      if (table === "generations") {
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

const MOCK_USER = { id: "user-123", email: "test@example.com" };

const MOCK_PRODUCT = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Serum Vitamin C Premium",
  category: "kecantikan",
  brand: "GlowLab",
  price: "Rp 150.000",
  target_market: "Wanita 25-35",
  usp: "Mengandung 20% Vitamin C murni",
  benefits: "Mencerahkan kulit dalam 14 hari",
};

const MOCK_CAPTIONS = [
  {
    text: "Caption 1 body text...",
    hashtags: ["#glowingskin", "#vitaminc", "#tiktokfinds"],
    tips: "Pakai untuk konten TikTok casual",
  },
  {
    text: "Caption 2 body text...",
    hashtags: ["#skincare", "#reviewjujur"],
    tips: "Cocok untuk Instagram carousel",
  },
  {
    text: "Caption 3 body text...",
    hashtags: ["#promo", "#diskon", "#ad"],
    tips: "Untuk Facebook marketplace-style",
  },
];

function makeFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("productId", overrides.productId ?? MOCK_PRODUCT.id);
  fd.set("platform", overrides.platform ?? "tiktok");
  fd.set("tone", overrides.tone ?? "casual");
  fd.set("audience", overrides.audience ?? "Wanita 20-35");
  if (overrides.cta !== undefined) {
    fd.set("cta", overrides.cta);
  }
  return fd;
}

// ---- Tests -----------------------------------------------------------------

describe("generateCaptions Server Action", () => {
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
      content: JSON.stringify(MOCK_CAPTIONS),
      tokensUsed: 200,
      durationMs: 800,
      model: "test-model",
    });
  });

  // 1. Happy path
  it("returns parsed captions on the happy path", async () => {
    const { generateCaptions } = await import("@/lib/actions/captions");

    const result = await generateCaptions(makeFormData());

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual(MOCK_CAPTIONS);
  });

  // 2. Validates Zod schema
  it("returns error when Zod validation fails (invalid platform)", async () => {
    const { generateCaptions } = await import("@/lib/actions/captions");

    const result = await generateCaptions(
      makeFormData({ platform: "myspace" })
    );

    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(mockCheckAndIncrementUsage).not.toHaveBeenCalled();
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  // 3. Saves to generations table
  it("inserts a generations row with the correct shape (module=caption)", async () => {
    const { generateCaptions } = await import("@/lib/actions/captions");

    await generateCaptions(makeFormData());

    expect(mockInsert).toHaveBeenCalledTimes(1);
    const inserted = mockInsert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(inserted.user_id).toBe(MOCK_USER.id);
    expect(inserted.module).toBe("caption");
    expect(inserted.subtype).toBe("tiktok");
    expect(inserted.status).toBe("completed");
    expect(typeof inserted.input_prompt).toBe("string");
    expect(Array.isArray(inserted.result)).toBe(true);
    expect((inserted.result as unknown[]).length).toBe(MOCK_CAPTIONS.length);
    expect(inserted.tokens_used).toBe(200);
    expect(inserted.duration_ms).toBe(800);
    expect(inserted.model).toBe("test-model");
  });

  // ---- Edge cases --------------------------------------------------------

  // 4. Not signed in
  it("returns error when user is not signed in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const { generateCaptions } = await import("@/lib/actions/captions");

    const result = await generateCaptions(makeFormData());

    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(mockCheckAndIncrementUsage).not.toHaveBeenCalled();
  });

  // 5. Usage limit reached
  it("returns error when usage limit is reached", async () => {
    mockCheckAndIncrementUsage.mockResolvedValue({
      allowed: false,
      remaining: 0,
    });
    const { generateCaptions } = await import("@/lib/actions/captions");

    const result = await generateCaptions(makeFormData());

    expect(result.data).toBeUndefined();
    expect(result.error).toMatch(/batas|limit/i);
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  // 6. Product not found
  it("returns error when the product is not found", async () => {
    mockProductSingle.mockResolvedValue({
      data: null,
      error: { message: "Not found" },
    });
    const { generateCaptions } = await import("@/lib/actions/captions");

    const result = await generateCaptions(makeFormData());

    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  // 7. AI returns invalid JSON
  it("returns error when the AI response is not valid JSON", async () => {
    mockGenerateText.mockResolvedValue({
      content: "not json at all",
      tokensUsed: 50,
      durationMs: 200,
      model: "test-model",
    });
    const { generateCaptions } = await import("@/lib/actions/captions");

    const result = await generateCaptions(makeFormData());

    expect(result.data).toBeUndefined();
    expect(result.error).toMatch(/tidak valid|invalid/i);
  });

  // 8. Edge case — cta is optional
  it("accepts missing cta field and still succeeds (cta optional)", async () => {
    const { generateCaptions } = await import("@/lib/actions/captions");

    // makeFormData() with no cta override -> cta is NOT set on FormData
    const result = await generateCaptions(makeFormData());

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual(MOCK_CAPTIONS);
    // The model should still be called even without cta
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
  });
});
