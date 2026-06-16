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

const MOCK_USER = { id: "user-303", email: "social@example.com" };

const MOCK_PRODUCT = {
  id: "55555555-5555-4555-8555-555555555555",
  name: "Serum Vitamin C Premium",
  category: "kecantikan",
  brand: "GlowLab",
  price: "Rp 150.000",
  target_market: "Wanita 25-35",
  usp: "Mengandung 20% Vitamin C murni",
  benefits: "Mencerahkan kulit dalam 14 hari",
};

/**
 * Sample 7-day social media calendar payload. Mirrors
 * `SocialResult` from `lib/actions/social.ts` — `platform` echo +
 * `days` array of 7 day-objects (day, contentType, topic, caption,
 * hashtags, bestTime).
 */
const MOCK_SOCIAL_CALENDAR = {
  platform: "tiktok",
  days: [
    {
      day: 1,
      contentType: "Reels",
      topic: "Unboxing produk pertama kali",
      caption:
        "Hai kak! Hari ini aku mau unboxing GlowLab Serum Vitamin C 20% yang viral itu. Penasaran banget hasilnya di kulitku yang sensitif. Stay tuned sampai habis ya!",
      hashtags: ["#serumvitaminC", "#skincare", "#glowlab", "#unboxing"],
      bestTime: "19:00 WIB",
    },
    {
      day: 2,
      contentType: "Story",
      topic: "First impression tekstur",
      caption:
        "Teksturnya ringan banget, cepat menyerap, dan nggak lengket. Cocok buat kulit kombinasi kayak aku. Repost kalau kamu juga suka serum yang ringan!",
      hashtags: ["#firstimpression", "#serumvitaminC", "#skincaretips"],
      bestTime: "11:00 WIB",
    },
    {
      day: 3,
      contentType: "Carousel",
      topic: "3 kandungan utama dan fungsinya",
      caption:
        "Slide 1: Vitamin C 20% untuk cerahkan. Slide 2: Niacinamide untuk hilangkan noda hitam. Slide 3: Hyaluronic Acid untuk hidrasi. Save post ini buat referensi skincare kamu ya!",
      hashtags: ["#kandunganskincare", "#glowlab", "#edukatif", "#skincare"],
      bestTime: "12:00 WIB",
    },
    {
      day: 4,
      contentType: "Reels",
      topic: "Before-after 7 hari pakai",
      caption:
        "Hari ke-7 pakai GlowLab Serum Vitamin C 20% — noda hitam di pipi mulai pudar, kulit terasa lebih cerah merata. Real result, no filter!",
      hashtags: ["#beforeafter", "#serumvitaminC", "#7harichallenge", "#skincare"],
      bestTime: "20:00 WIB",
    },
    {
      day: 5,
      contentType: "Short",
      topic: "Cara pakai yang benar (urutan skincare)",
      caption:
        "Step 1: Cuci muka. Step 2: Toner. Step 3: GlowLab Serum Vitamin C 20% (2-3 tetes). Step 4: Moisturizer. Step 5: Sunscreen (pagi). Simpel banget kan!",
      hashtags: ["#urutanskincare", "#tutorial", "#glowlab", "#serumvitaminC"],
      bestTime: "17:00 WIB",
    },
    {
      day: 6,
      contentType: "Story",
      topic: "Review jujur setelah 2 minggu",
      caption:
        "2 minggu pakai GlowLab Serum Vitamin C 20% — verdict: WORTH IT. Noda hitam memudar, kulit lebih cerah, nggak breakout. Bakal repurchase!",
      hashtags: ["#reviewjujur", "#serumvitaminC", "#skincarereview"],
      bestTime: "21:00 WIB",
    },
    {
      day: 7,
      contentType: "Reels",
      topic: "CTA — checkout sekarang, stok terbatas",
      caption:
        "Stok GlowLab Serum Vitamin C 20% tinggal 50-an lagi kak! Klik keranjang kuning sekarang, free ongkir ke seluruh Indonesia. Buruan sebelum kehabisan!",
      hashtags: ["#stokterbatas", "#glowlab", "#serumvitaminC", "#checkoutsekarang"],
      bestTime: "19:30 WIB",
    },
  ],
};

function makeFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("productId", overrides.productId ?? MOCK_PRODUCT.id);
  fd.set("platform", overrides.platform ?? "tiktok");
  fd.set("tone", overrides.tone ?? "kasual");
  return fd;
}

// ---- Tests -----------------------------------------------------------------

describe("generateSocialCalendar Server Action", () => {
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
      content: JSON.stringify(MOCK_SOCIAL_CALENDAR),
      tokensUsed: 760,
      durationMs: 2200,
      model: "test-model",
    });
  });

  // 1. Happy path
  it("returns the parsed 7-day social calendar on the happy path", async () => {
    const { generateSocialCalendar } = await import(
      "@/lib/actions/social"
    );

    const result = await generateSocialCalendar(makeFormData());

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual(MOCK_SOCIAL_CALENDAR);
    expect(result.data?.days).toHaveLength(7);
  });

  // 2. Usage limit reached
  it("returns error when usage limit is reached", async () => {
    mockCheckAndIncrementUsage.mockResolvedValue({
      allowed: false,
      remaining: 0,
    });
    const { generateSocialCalendar } = await import(
      "@/lib/actions/social"
    );

    const result = await generateSocialCalendar(makeFormData());

    expect(result.data).toBeUndefined();
    expect(result.error).toMatch(/batas|limit/i);
  });

  // 3. User not signed in
  it("returns error when user is not signed in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const { generateSocialCalendar } = await import(
      "@/lib/actions/social"
    );

    const result = await generateSocialCalendar(makeFormData());

    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
  });

  // 4. AI response is not valid JSON
  it("returns error when the AI response is not valid JSON", async () => {
    mockGenerateText.mockResolvedValue({
      content: "not-json{{{}",
      tokensUsed: 50,
      durationMs: 100,
      model: "test-model",
    });
    const { generateSocialCalendar } = await import(
      "@/lib/actions/social"
    );

    const result = await generateSocialCalendar(makeFormData());

    expect(result.data).toBeUndefined();
    expect(result.error).toMatch(/tidak valid|invalid/i);
  });

  // 5. Product not found
  it("returns error when the product is not found", async () => {
    mockProductSingle.mockResolvedValue({
      data: null,
      error: { message: "Not found" },
    });
    const { generateSocialCalendar } = await import(
      "@/lib/actions/social"
    );

    const result = await generateSocialCalendar(makeFormData());

    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
  });

  // 6. Zod validation fails (invalid platform)
  it("returns error when Zod validation fails (invalid platform)", async () => {
    const { generateSocialCalendar } = await import(
      "@/lib/actions/social"
    );

    const result = await generateSocialCalendar(
      makeFormData({ platform: "myspace" }),
    );

    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
  });

  // 7. Persists a 'social' generation row with the chosen platform as subtype
  it("persists a 'social' generation row with the chosen platform as subtype", async () => {
    const { generateSocialCalendar } = await import(
      "@/lib/actions/social"
    );

    await generateSocialCalendar(makeFormData({ platform: "instagram" }));

    expect(mockInsert).toHaveBeenCalledTimes(1);
    const inserted = mockInsert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(inserted.module).toBe("social");
    expect(inserted.subtype).toBe("instagram");
  });
});
