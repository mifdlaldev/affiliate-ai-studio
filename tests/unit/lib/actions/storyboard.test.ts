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

const MOCK_USER = { id: "user-1" };

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

// 7-panel storyboard (target for 30s video)
const MOCK_STORYBOARD = [
  {
    panel: 1,
    time: "0-3s",
    visuals: "Close-up wajah kusam di cermin, pencahayaan redup kamar mandi",
    audio: "Kulit kusam bikin nggak pede?",
    text: "STOP!",
    cameraAngle: "Extreme close-up wajah",
    transition: "Jump cut",
  },
  {
    panel: 2,
    time: "3-7s",
    visuals: "Tangan membuka kemasan serum, cahaya terang dari jendela",
    audio: "Coba serum Vitamin C 20% dari GlowLab",
    text: "GlowLab Serum",
    cameraAngle: "Medium shot produk + tangan",
    transition: "Cut langsung",
  },
  {
    panel: 3,
    time: "7-15s",
    visuals: "Teteskan serum ke telapak tangan, close-up tekstur",
    audio: "Teksturnya ringan banget, cepat menyerap",
    text: "20% Vitamin C",
    cameraAngle: "Close-up produk",
    transition: "Fade",
  },
  {
    panel: 4,
    time: "15-22s",
    visuals: "Aplikasikan serum ke wajah, gerakan memutar lembut",
    audio: "Rasanya adem, wanginya soft banget",
    text: "",
    cameraAngle: "Overhead flat lay",
    transition: "Wipe kanan",
  },
  {
    panel: 5,
    time: "22-26s",
    visuals: "Split screen before/after, kulit lebih cerah",
    audio: "Hari ke-7, kelihatan banget bedanya",
    text: "Hasil 7 hari",
    cameraAngle: "Wide shot split",
    transition: "Cross dissolve",
  },
  {
    panel: 6,
    time: "26-29s",
    visuals: "Talent senyum puas, pencahayaan golden hour",
    audio: "Glowing tanpa makeup udah pede banget",
    text: "Glowing in 7 days",
    cameraAngle: "Medium close-up talent",
    transition: "Zoom in",
  },
  {
    panel: 7,
    time: "29-30s",
    visuals: "Produk di tengah frame, link di caption",
    audio: "Link di keranjang kuning ya, stok terbatas",
    text: "Beli sekarang",
    cameraAngle: "Eye-level product hero",
    transition: "",
  },
];

function makeFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("productId", overrides.productId ?? MOCK_PRODUCT.id);
  fd.set("platform", overrides.platform ?? "tiktok");
  fd.set("tone", overrides.tone ?? "casual");
  fd.set("duration", overrides.duration ?? "30");
  return fd;
}

// ---- Reset mocks before each test -----------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });
  mockCheckAndIncrementUsage.mockResolvedValue({
    allowed: true,
    remaining: 42,
  });
  mockProductSingle.mockResolvedValue({ data: MOCK_PRODUCT, error: null });
  mockInsert.mockResolvedValue({ error: null });
  mockGenerateText.mockResolvedValue({
    content: JSON.stringify(MOCK_STORYBOARD),
    tokensUsed: 1234,
    durationMs: 5000,
    model: "deepseek-v4-flash-free",
  });
});

// ---- Tests -----------------------------------------------------------------

describe("generateStoryboard", () => {
  // 1. Happy path
  it("returns the parsed storyboard panels and persists the generation on success", async () => {
    const { generateStoryboard } = await import("@/lib/actions/storyboard");

    const result = await generateStoryboard(makeFormData());

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual(MOCK_STORYBOARD);
    expect(result.data).toHaveLength(7);

    // The model must be called in JSON mode with the storyboard system prompt.
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    const callArgs = mockGenerateText.mock.calls[0]?.[0] as {
      jsonMode: boolean;
      systemPrompt: string;
      prompt: string;
    };
    expect(callArgs.jsonMode).toBe(true);
    expect(callArgs.systemPrompt).toMatch(/storyboard|panel/i);
    // Product name + platform + tone + duration must all be in the prompt.
    expect(callArgs.prompt).toContain(MOCK_PRODUCT.name);
    expect(callArgs.prompt).toContain("tiktok");
    expect(callArgs.prompt).toContain("casual");
    expect(callArgs.prompt).toContain("30");
  });

  // 2. Usage limit reached
  it("returns error when usage limit is reached", async () => {
    mockCheckAndIncrementUsage.mockResolvedValue({
      allowed: false,
      remaining: 0,
    });
    const { generateStoryboard } = await import("@/lib/actions/storyboard");

    const result = await generateStoryboard(makeFormData());

    expect(result.error).toMatch(/batas|limit/i);
    expect(result.data).toBeUndefined();
    // AI must NOT be called when limit is hit.
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  // 3. Not signed in
  it("returns error when user is not signed in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const { generateStoryboard } = await import("@/lib/actions/storyboard");

    const result = await generateStoryboard(makeFormData());

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
    const { generateStoryboard } = await import("@/lib/actions/storyboard");

    const result = await generateStoryboard(makeFormData());

    expect(result.data).toBeUndefined();
    expect(result.error).toMatch(/tidak valid|invalid/i);
  });

  // 5. Product not found
  it("returns error when the product is not found", async () => {
    mockProductSingle.mockResolvedValue({
      data: null,
      error: { message: "Not found" },
    });
    const { generateStoryboard } = await import("@/lib/actions/storyboard");

    const result = await generateStoryboard(makeFormData());

    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  // 6. Zod validation fails
  it("returns error when Zod validation fails (invalid duration)", async () => {
    const { generateStoryboard } = await import("@/lib/actions/storyboard");

    const result = await generateStoryboard(makeFormData({ duration: "45" }));

    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(mockCheckAndIncrementUsage).not.toHaveBeenCalled();
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  // 7. Persists with module: "storyboard", subtype = platform
  it("inserts a generations row with module='storyboard' and subtype=platform", async () => {
    const { generateStoryboard } = await import("@/lib/actions/storyboard");

    await generateStoryboard(makeFormData({ platform: "instagram" }));

    expect(mockInsert).toHaveBeenCalledTimes(1);
    const inserted = mockInsert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(inserted.module).toBe("storyboard");
    expect(inserted.subtype).toBe("instagram");
    expect(inserted.status).toBe("completed");
    expect(inserted.user_id).toBe(MOCK_USER.id);
    expect(inserted.tokens_used).toBe(1234);
  });

  // 8. Edge case — duration '60' forwards 8-panel target to the model
  it("accepts duration='60' and forwards the 8-panel target to the model", async () => {
    const { generateStoryboard } = await import("@/lib/actions/storyboard");

    const result = await generateStoryboard(makeFormData({ duration: "60" }));

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual(MOCK_STORYBOARD);
    // The model must be called exactly once with the 60-second prompt.
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    const callArgs = mockGenerateText.mock.calls[0]?.[0] as {
      prompt: string;
    };
    expect(callArgs.prompt).toMatch(/60 detik/);
    // 60s → target 8 panel.
    expect(callArgs.prompt).toContain("8 panel");
  });
});
