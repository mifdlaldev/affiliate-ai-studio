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

const MOCK_USER = { id: "user-789", email: "livehost@example.com" };

const MOCK_PRODUCT = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "Serum Vitamin C Premium",
  category: "kecantikan",
  brand: "GlowLab",
  price: "Rp 150.000",
  target_market: "Wanita 25-35",
  usp: "Mengandung 20% Vitamin C murni",
  benefits: "Mencerahkan kulit dalam 14 hari",
};

/**
 * Sample live-host script payload. Mirrors `LiveHostResult` from
 * `lib/actions/live-host.ts` — one script with three segments, a CTA.
 */
const MOCK_LIVE_SCRIPT = {
  title: "Live 30 menit: Serum GlowLab",
  segments: [
    {
      time: "0-2 menit",
      segmentName: "Opening",
      hostScript:
        "Halo kak! Welcome back di channel aku. Hari ini aku mau spill serum yang lagi viral banget di TikTok...",
      keyPoints: [
        "Sapa penonton",
        "Introduksi host & topik live",
        "Tanya di kolom komentar",
      ],
      engagementTip: "Ketik 'GLOW' di komentar kalau mau lanjut demo produk!",
    },
    {
      time: "2-15 menit",
      segmentName: "Demo Produk",
      hostScript:
        "Oke, sekarang aku langsung demo. Ini serum-nya, bentuknya kayak gini, teksturnya lightweight banget...",
      keyPoints: [
        "Tunjukkan tekstur & warna produk",
        "Aplikasikan ke kulit",
        "Highlight USP utama",
      ],
      engagementTip:
        "Drop emoji ❤️ di komentar kalau kalian juga punya masalah kulit kusam!",
    },
    {
      time: "15-30 menit",
      segmentName: "CTA Closing",
      hostScript:
        "Oke kak, stoknya tinggal 50 lagi, langsung klik keranjang kuning ya. Ada bonus pouch cantik buat 100 pembelanja pertama!",
      keyPoints: [
        "Tutup dengan urgency",
        "Arahkan ke keranjang kuning",
        "Sebut bonus / diskon",
      ],
      engagementTip: "Beli sekarang sebelum harga naik jam 12 malam!",
    },
  ],
  cta: "Klik keranjang kuning sekarang, stok terbatas dan ada bonus pouch cantik!",
};

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

describe("generateLiveScript Server Action", () => {
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
      content: JSON.stringify(MOCK_LIVE_SCRIPT),
      tokensUsed: 420,
      durationMs: 1500,
      model: "test-model",
    });
  });

  // 1. Happy path
  it("returns parsed live script on the happy path", async () => {
    const { generateLiveScript } = await import("@/lib/actions/live-host");

    const result = await generateLiveScript(makeFormData());

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual(MOCK_LIVE_SCRIPT);
  });

  // 2. Usage limit reached
  it("returns error when usage limit is reached", async () => {
    mockCheckAndIncrementUsage.mockResolvedValue({
      allowed: false,
      remaining: 0,
    });
    const { generateLiveScript } = await import("@/lib/actions/live-host");

    const result = await generateLiveScript(makeFormData());

    expect(result.data).toBeUndefined();
    expect(result.error).toMatch(/batas|limit/i);
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  // 3. Not signed in
  it("returns error when user is not signed in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const { generateLiveScript } = await import("@/lib/actions/live-host");

    const result = await generateLiveScript(makeFormData());

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
    const { generateLiveScript } = await import("@/lib/actions/live-host");

    const result = await generateLiveScript(makeFormData());

    expect(result.data).toBeUndefined();
    expect(result.error).toMatch(/tidak valid|invalid/i);
  });

  // 5. Product not found
  it("returns error when the product is not found", async () => {
    mockProductSingle.mockResolvedValue({
      data: null,
      error: { message: "Not found" },
    });
    const { generateLiveScript } = await import("@/lib/actions/live-host");

    const result = await generateLiveScript(makeFormData());

    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  // 6. Zod validation fails
  it("returns error when Zod validation fails (invalid duration)", async () => {
    const { generateLiveScript } = await import("@/lib/actions/live-host");

    const result = await generateLiveScript(makeFormData({ duration: "45" }));

    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(mockCheckAndIncrementUsage).not.toHaveBeenCalled();
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  // 7. Saves to generations table
  it("inserts a generations row with the correct shape (module=live-host)", async () => {
    const { generateLiveScript } = await import("@/lib/actions/live-host");

    await generateLiveScript(makeFormData());

    expect(mockInsert).toHaveBeenCalledTimes(1);
    const inserted = mockInsert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(inserted.user_id).toBe(MOCK_USER.id);
    expect(inserted.module).toBe("live-host");
    expect(inserted.subtype).toBe("tiktok");
    expect(inserted.status).toBe("completed");
    expect(inserted.tokens_used).toBe(420);
    expect(inserted.duration_ms).toBe(1500);
    expect(inserted.result).toEqual(MOCK_LIVE_SCRIPT);
  });

  // 8. Edge case — duration '60' (longest live) is accepted and forwarded
  it("accepts duration='60' and forwards it to the model with 'menit' (not detik)", async () => {
    const { generateLiveScript } = await import("@/lib/actions/live-host");

    const result = await generateLiveScript(makeFormData({ duration: "60" }));

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual(MOCK_LIVE_SCRIPT);
    // The model must be called exactly once with the 60-minute prompt.
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    const callArgs = mockGenerateText.mock.calls[0]?.[0] as {
      prompt: string;
    };
    expect(callArgs.prompt).toMatch(/60 menit/);
    expect(callArgs.prompt).not.toMatch(/60 detik/);
  });
});
