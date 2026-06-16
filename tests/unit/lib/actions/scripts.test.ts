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

const MOCK_USER = { id: "user-456", email: "creator@example.com" };

const MOCK_PRODUCT = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Serum Vitamin C Premium",
  category: "kecantikan",
  brand: "GlowLab",
  price: "Rp 150.000",
  target_market: "Wanita 25-35",
  usp: "Mengandung 20% Vitamin C murni",
  benefits: "Mencerahkan kulit dalam 14 hari",
};

const MOCK_SCRIPTS = [
  {
    title: "Storyboard problem-solution",
    scenes: [
      {
        time: "0-3s",
        visuals: "Wajah kusam di cermin, pencahayaan redup",
        audio: "Kulit kusam bikin nggak pede?",
        text: "",
      },
      {
        time: "3-15s",
        visuals: "Buka serum, teteskan ke tangan, oles ke wajah",
        audio: "Coba serum Vitamin C 20% dari GlowLab",
        text: "GlowLab Serum",
      },
      {
        time: "15-30s",
        visuals: "Before/after kulit lebih cerah, ekspresi sumringah",
        audio: "Dalam 14 hari kulit lebih cerah dan glowing",
        text: "Hasil dalam 14 hari",
      },
    ],
    cta: "Beli sekarang di keranjang kuning, stok terbatas!",
  },
];

function makeFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("productId", overrides.productId ?? MOCK_PRODUCT.id);
  fd.set("platform", overrides.platform ?? "tiktok");
  fd.set("tone", overrides.tone ?? "casual");
  fd.set("audience", overrides.audience ?? "Wanita 20-35");
  fd.set("duration", overrides.duration ?? "30");
  return fd;
}

// ---- Tests -----------------------------------------------------------------

describe("generateScripts Server Action", () => {
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
      content: JSON.stringify(MOCK_SCRIPTS),
      tokensUsed: 350,
      durationMs: 1200,
      model: "test-model",
    });
  });

  // 1. Happy path
  it("returns parsed scripts on the happy path", async () => {
    const { generateScripts } = await import("@/lib/actions/scripts");

    const result = await generateScripts(makeFormData());

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual(MOCK_SCRIPTS);
  });

  // 2. Usage limit reached
  it("returns error when usage limit is reached", async () => {
    mockCheckAndIncrementUsage.mockResolvedValue({
      allowed: false,
      remaining: 0,
    });
    const { generateScripts } = await import("@/lib/actions/scripts");

    const result = await generateScripts(makeFormData());

    expect(result.data).toBeUndefined();
    expect(result.error).toMatch(/batas|limit/i);
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  // 3. Not signed in
  it("returns error when user is not signed in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const { generateScripts } = await import("@/lib/actions/scripts");

    const result = await generateScripts(makeFormData());

    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(mockCheckAndIncrementUsage).not.toHaveBeenCalled();
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  // 4. AI response is not valid JSON
  it("returns error when the AI response is not valid JSON", async () => {
    mockGenerateText.mockResolvedValue({
      content: "this is not json at all",
      tokensUsed: 50,
      durationMs: 200,
      model: "test-model",
    });
    const { generateScripts } = await import("@/lib/actions/scripts");

    const result = await generateScripts(makeFormData());

    expect(result.data).toBeUndefined();
    expect(result.error).toMatch(/tidak valid|invalid/i);
  });

  // 5. Product not found
  it("returns error when the product is not found", async () => {
    mockProductSingle.mockResolvedValue({
      data: null,
      error: { message: "Not found" },
    });
    const { generateScripts } = await import("@/lib/actions/scripts");

    const result = await generateScripts(makeFormData());

    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  // 6. Zod validation fails
  it("returns error when Zod validation fails (invalid duration)", async () => {
    const { generateScripts } = await import("@/lib/actions/scripts");

    const result = await generateScripts(makeFormData({ duration: "45" }));

    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(mockCheckAndIncrementUsage).not.toHaveBeenCalled();
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  // 7. Saves to generations table
  it("inserts a generations row with the correct shape (module=script)", async () => {
    const { generateScripts } = await import("@/lib/actions/scripts");

    await generateScripts(makeFormData());

    expect(mockInsert).toHaveBeenCalledTimes(1);
    const inserted = mockInsert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(inserted.user_id).toBe(MOCK_USER.id);
    expect(inserted.module).toBe("script");
    expect(inserted.subtype).toBe("tiktok");
    expect(inserted.status).toBe("completed");
    expect(typeof inserted.input_prompt).toBe("string");
    expect(Array.isArray(inserted.result)).toBe(true);
    expect((inserted.result as unknown[]).length).toBe(MOCK_SCRIPTS.length);
    expect(inserted.tokens_used).toBe(350);
    expect(inserted.duration_ms).toBe(1200);
    expect(inserted.model).toBe("test-model");
  });

  // 8. Edge case — duration value
  it("accepts duration='60' and forwards it to the model", async () => {
    const { generateScripts } = await import("@/lib/actions/scripts");

    const result = await generateScripts(makeFormData({ duration: "60" }));

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual(MOCK_SCRIPTS);
    // The model must be called exactly once with the 60-second prompt.
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    const callArgs = mockGenerateText.mock.calls[0]?.[0] as {
      prompt: string;
    };
    expect(callArgs.prompt).toMatch(/60 detik/);
  });
});
