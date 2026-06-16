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

const MOCK_USER = { id: "user-707", email: "affiliate@example.com" };

const MOCK_PRODUCT = {
  id: "11111111-2222-4333-8444-555555555555",
  name: "Kursus Online Copywriting AI",
  category: "edukasi",
  brand: "BelajarAI",
  price: "Rp 499.000",
  target_market: "Pemula 20-40 tahun",
  usp: "12 modul + 1-on-1 mentoring",
  benefits: "Belajar 12 modul\n1-on-1 mentoring",
};

/**
 * Sample landing-page payload. Mirrors `LandingResult` from
 * `lib/actions/landing.ts` — headline, subheadline, heroDescription,
 * features (array of {title, description}), pricing (array of
 * {plan, price, features}), faq (array of {question, answer}), cta.
 */
const MOCK_LANDING = {
  headline: "Jadi Copywriter AI Profesional dalam 30 Hari",
  subheadline: "12 modul video + mentoring 1-on-1 dengan praktisi",
  heroDescription:
    "Belajar dari dasar hingga mahir membuat copy yang menghasilkan konversi tinggi. Cocok untuk pemula yang ingin kerja remote sebagai copywriter.",
  features: [
    {
      title: "12 Modul Video HD",
      description:
        "Materi terstruktur dari fundamental AI, prompt engineering, hingga advanced copy frameworks.",
    },
    {
      title: "1-on-1 Mentoring 60 Menit",
      description:
        "Sesi privat dengan copywriter profesional bersertifikat untuk review portofolio.",
    },
    {
      title: "Komunitas Selamanya",
      description:
        "Akses ke grup Telegram eksklusif dengan 2.000+ alumni yang aktif sharing job dan tips.",
    },
  ],
  pricing: [
    {
      plan: "Belajar Mandiri",
      price: "Rp 299.000",
      features: [
        "12 modul video HD",
        "Akses komunitas selamanya",
        "Sertifikat digital",
      ],
    },
    {
      plan: "Belajar + Mentoring",
      price: "Rp 499.000",
      features: [
        "Semua paket Belajar Mandiri",
        "1-on-1 mentoring 60 menit",
        "Review portofolio personal",
      ],
    },
  ],
  faq: [
    {
      question: "Apakah cocok untuk pemula total?",
      answer:
        "Ya, semua materi dirancang dari nol dan tidak butuh pengalaman coding atau copywriting sebelumnya.",
    },
    {
      question: "Berapa lama akses ke materi?",
      answer:
        "Akses selamanya, termasuk update materi terbaru tanpa biaya tambahan.",
    },
    {
      question: "Apakah ada garansi uang kembali?",
      answer:
        "Ya, garansi 100% uang kembali dalam 14 hari pertama jika belum puas.",
    },
  ],
  cta: "Daftar sekarang dan mulai jadi copywriter AI profesional — kuota mentoring hanya 20 slot per bulan!",
};

function makeFormData(
  overrides: Record<string, string> = {},
): FormData {
  const fd = new FormData();
  fd.set("productId", overrides.productId ?? MOCK_PRODUCT.id);
  fd.set("tone", overrides.tone ?? "profesional");
  return fd;
}

// ---- Tests -----------------------------------------------------------------

describe("generateLandingPage Server Action", () => {
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
      content: JSON.stringify(MOCK_LANDING),
      tokensUsed: 520,
      durationMs: 1850,
      model: "test-model",
    });
  });

  // 1. Happy path
  it("returns the parsed landing page on the happy path", async () => {
    const { generateLandingPage } = await import("@/lib/actions/landing");

    const result = await generateLandingPage(makeFormData());

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual(MOCK_LANDING);
  });

  // 2. Usage limit reached
  it("returns error when usage limit is reached", async () => {
    mockCheckAndIncrementUsage.mockResolvedValue({
      allowed: false,
      remaining: 0,
    });
    const { generateLandingPage } = await import("@/lib/actions/landing");

    const result = await generateLandingPage(makeFormData());

    expect(result.error).toBeDefined();
    expect(result.error).toMatch(/batas|limit/i);
  });

  // 3. Unauthenticated user
  it("returns error when user is not signed in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const { generateLandingPage } = await import("@/lib/actions/landing");

    const result = await generateLandingPage(makeFormData());

    expect(result.error).toBeDefined();
  });

  // 4. Zod validation fails (invalid tone)
  it("returns error when Zod validation fails (invalid tone)", async () => {
    const { generateLandingPage } = await import("@/lib/actions/landing");

    const result = await generateLandingPage(
      makeFormData({ tone: "robotik" }),
    );

    expect(result.error).toBeDefined();
  });

  // 5. Product not found
  it("returns error when the product is not found", async () => {
    mockProductSingle.mockResolvedValue({
      data: null,
      error: { message: "Not found" },
    });
    const { generateLandingPage } = await import("@/lib/actions/landing");

    const result = await generateLandingPage(makeFormData());

    expect(result.error).toBeDefined();
  });

  // 6. AI response is not valid JSON
  it("returns error when the AI response is not valid JSON", async () => {
    mockGenerateText.mockResolvedValue({
      content: "bukan json, ini plain text",
      tokensUsed: 50,
      durationMs: 200,
      model: "test-model",
    });
    const { generateLandingPage } = await import("@/lib/actions/landing");

    const result = await generateLandingPage(makeFormData());

    expect(result.error).toBeDefined();
    expect(result.error).toMatch(/tidak valid|invalid/i);
  });

  // 7. Persists a 'landing' generation row with the chosen tone as subtype
  it("persists a 'landing' generation row with the chosen tone as subtype", async () => {
    const { generateLandingPage } = await import("@/lib/actions/landing");

    await generateLandingPage(makeFormData({ tone: "persuasif" }));

    expect(mockInsert).toHaveBeenCalledTimes(1);
    const inserted = mockInsert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(inserted.module).toBe("landing");
    expect(inserted.subtype).toBe("persuasif");
  });

  // 8. Unexpected errors are caught and surfaced as a friendly message
  it("returns a friendly error when an unexpected exception is thrown", async () => {
    mockGenerateText.mockRejectedValue(new Error("boom"));
    const { generateLandingPage } = await import("@/lib/actions/landing");

    const result = await generateLandingPage(makeFormData());

    expect(result.error).toBeDefined();
  });
});
