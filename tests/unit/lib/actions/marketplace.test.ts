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

const MOCK_USER = { id: "user-202", email: "seller@example.com" };

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
 * Sample marketplace description payload. Mirrors `MarketplaceResult`
 * from `lib/actions/marketplace.ts` — title, shortDescription, full
 * description, bullet points, tags, cta.
 */
const MOCK_MARKETPLACE_DESC = {
  title: "GlowLab Serum Vitamin C 20% Premium - Mencerahkan Kulit 14 Hari",
  shortDescription:
    "Serum vitamin C konsentrasi tinggi dengan niacinamide untuk kulit cerah merata dalam 14 hari.",
  description:
    "GlowLab Serum Vitamin C 20% adalah serum wajah premium yang diformulasikan untuk wanita Indonesia yang ingin mendapatkan kulit cerah merata, kencang, dan bebas noda hitam. Kandungan 20% vitamin C murni yang dipadukan dengan niacinamide bekerja efektif mengurangi hiperpigmentasi, meningkatkan produksi kolagen, serta melindungi kulit dari radikal bebas. Tekstur ringan dan cepat menyerap tanpa meninggalkan rasa lengket. Cocok untuk semua jenis kulit, termasuk kulit sensitif. Gunakan pagi dan malam hari sebelum pelembap untuk hasil optimal.",
  bulletPoints: [
    "Mengandung 20% Vitamin C murni",
    "Diperkaya Niacinamide untuk kulit cerah merata",
    "Tekstur ringan, cepat menyerap, tidak lengket",
    "Aman untuk semua jenis kulit termasuk sensitif",
    "Hasil terlihat dalam 14 hari pemakaian rutin",
  ],
  tags: [
    "serum vitamin c",
    "skincare pencerah",
    "glowlab",
    "serum wajah",
    "anti aging",
  ],
  cta: "Klik keranjang kuning sekarang, stok terbatas dan free ongkir ke seluruh Indonesia!",
};

function makeFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("productId", overrides.productId ?? MOCK_PRODUCT.id);
  fd.set("platform", overrides.platform ?? "shopee");
  fd.set("style", overrides.style ?? "profesional");
  fd.set("length", overrides.length ?? "sedang");
  fd.set(
    "includeSpecs",
    overrides.includeSpecs ?? "true",
  );
  fd.set(
    "targetAudience",
    overrides.targetAudience ?? "Wanita 25-35 peduli skincare",
  );
  return fd;
}

// ---- Tests -----------------------------------------------------------------

describe("generateMarketplaceDescription Server Action", () => {
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
      content: JSON.stringify(MOCK_MARKETPLACE_DESC),
      tokensUsed: 480,
      durationMs: 1700,
      model: "test-model",
    });
  });

  // 1. Happy path
  it("returns the parsed marketplace description on the happy path", async () => {
    const { generateMarketplaceDescription } = await import(
      "@/lib/actions/marketplace"
    );

    const result = await generateMarketplaceDescription(makeFormData());

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual(MOCK_MARKETPLACE_DESC);
  });

  // 2. Usage limit reached
  it("returns error when usage limit is reached", async () => {
    mockCheckAndIncrementUsage.mockResolvedValue({
      allowed: false,
      remaining: 0,
    });
    const { generateMarketplaceDescription } = await import(
      "@/lib/actions/marketplace"
    );

    const result = await generateMarketplaceDescription(makeFormData());

    expect(result.data).toBeUndefined();
    expect(result.error).toMatch(/batas|limit/i);
  });

  // 3. User not signed in
  it("returns error when user is not signed in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const { generateMarketplaceDescription } = await import(
      "@/lib/actions/marketplace"
    );

    const result = await generateMarketplaceDescription(makeFormData());

    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
  });

  // 4. AI response is not valid JSON
  it("returns error when the AI response is not valid JSON", async () => {
    mockGenerateText.mockResolvedValue({
      content: "not-valid-json",
      tokensUsed: 50,
      durationMs: 100,
      model: "test-model",
    });
    const { generateMarketplaceDescription } = await import(
      "@/lib/actions/marketplace"
    );

    const result = await generateMarketplaceDescription(makeFormData());

    expect(result.data).toBeUndefined();
    expect(result.error).toMatch(/tidak valid|invalid/i);
  });

  // 5. Product not found
  it("returns error when the product is not found", async () => {
    mockProductSingle.mockResolvedValue({
      data: null,
      error: { message: "Not found" },
    });
    const { generateMarketplaceDescription } = await import(
      "@/lib/actions/marketplace"
    );

    const result = await generateMarketplaceDescription(makeFormData());

    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  // 6. Zod validation fails
  it("returns error when Zod validation fails (invalid platform)", async () => {
    const { generateMarketplaceDescription } = await import(
      "@/lib/actions/marketplace"
    );

    const result = await generateMarketplaceDescription(
      makeFormData({ platform: "bukalapak-extreme" }),
    );

    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
  });

  // 7. Forwards platform + style to the AI prompt
  it("forwards the platform and style to the AI prompt", async () => {
    const { generateMarketplaceDescription } = await import(
      "@/lib/actions/marketplace"
    );

    const result = await generateMarketplaceDescription(
      makeFormData({ platform: "tokopedia", style: "persuasif" }),
    );

    expect(result.error).toBeUndefined();
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    const callArgs = mockGenerateText.mock.calls[0]?.[0] as {
      prompt: string;
    };
    expect(callArgs.prompt).toMatch(/tokopedia/);
    expect(callArgs.prompt).toMatch(/persuasif/);
  });

  // 8. Persists a `marketplace` generation row with the chosen platform as subtype
  it("persists a 'marketplace' generation row with the chosen platform as subtype", async () => {
    const { generateMarketplaceDescription } = await import(
      "@/lib/actions/marketplace"
    );

    await generateMarketplaceDescription(
      makeFormData({ platform: "tiktok-shop" }),
    );

    expect(mockInsert).toHaveBeenCalledTimes(1);
    const inserted = mockInsert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(inserted.module).toBe("marketplace");
    expect(inserted.subtype).toBe("tiktok-shop");
  });
});
