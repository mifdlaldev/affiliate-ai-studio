import { describe, it, expect, vi, beforeEach } from "vitest";

// Module-level mock fns (referenced by the `vi.mock` factory bodies below).
// vitest hoists `vi.mock` above the `const` declarations at runtime, but the
// factory functions are not invoked until the module is first imported — by
// that point these bindings are already initialised, so the reference is safe.
const mockGetUser = vi.fn();
const mockProductsIn = vi.fn();
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
            // calendar fetches MULTIPLE products via .in("id", productIds)
            in: () => mockProductsIn(),
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

const MOCK_USER = { id: "user-202", email: "planner@example.com" };

const MOCK_PRODUCTS = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Serum Vitamin C Premium",
    category: "kecantikan",
    brand: "GlowLab",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Sunscreen SPF 50+ Daily",
    category: "kecantikan",
    brand: "GlowLab",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Moisturizer Light Gel",
    category: "kecantikan",
    brand: "GlowLab",
  },
];

// A 30-day calendar (June has 30 days) — used as the "happy path" response.
const MOCK_CALENDAR_30 = Array.from({ length: 30 }, (_, i) => ({
  day: i + 1,
  productId: MOCK_PRODUCTS[i % MOCK_PRODUCTS.length].id,
  productName: MOCK_PRODUCTS[i % MOCK_PRODUCTS.length].name,
  contentType: ["photo", "video", "story", "carousel", "reel"][i % 5],
  platform: "tiktok",
  topic: `Topik konten untuk hari ke-${i + 1} di bulan Juni`,
  hook: `Hook pembuka yang menarik untuk hari ${i + 1} bulan Juni ini`,
}));

// A 28-day calendar (February 2026 has 28 days) — used as the "edge case"
// response to verify the prompt + module + insertion still work when the
// target month has fewer than 30 days.
const MOCK_CALENDAR_28 = Array.from({ length: 28 }, (_, i) => ({
  day: i + 1,
  productId: MOCK_PRODUCTS[i % MOCK_PRODUCTS.length].id,
  productName: MOCK_PRODUCTS[i % MOCK_PRODUCTS.length].name,
  contentType: ["photo", "video", "story", "carousel", "reel"][i % 5],
  platform: "instagram",
  topic: `Topik konten hari ke-${i + 1} di Februari`,
  hook: `Hook pembuka untuk hari ke-${i + 1} bulan Februari`,
}));

interface FormOverrides {
  productIds?: string[];
  month?: string;
  year?: string;
  contentTypes?: string[];
  platform?: string;
  tone?: string;
}

function makeFormData(overrides: FormOverrides = {}): FormData {
  const fd = new FormData();
  const productIds = overrides.productIds ?? MOCK_PRODUCTS.map((p) => p.id);
  for (const id of productIds) {
    fd.append("productIds", id);
  }
  fd.set("month", overrides.month ?? "6");
  fd.set("year", overrides.year ?? "2026");
  const contentTypes = overrides.contentTypes ?? ["video", "story", "reel"];
  for (const ct of contentTypes) {
    fd.append("contentTypes", ct);
  }
  fd.set("platform", overrides.platform ?? "tiktok");
  fd.set("tone", overrides.tone ?? "casual");
  return fd;
}

// ---- Tests -----------------------------------------------------------------

describe("generateCalendar Server Action", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });
    mockCheckAndIncrementUsage.mockResolvedValue({
      allowed: true,
      remaining: 49,
    });
    mockProductsIn.mockResolvedValue({ data: MOCK_PRODUCTS, error: null });
    mockInsert.mockResolvedValue({ data: null, error: null });
    mockGenerateText.mockResolvedValue({
      content: JSON.stringify(MOCK_CALENDAR_30),
      tokensUsed: 4200,
      durationMs: 5500,
      model: "test-model",
    });
  });

  // 1. Happy path — 3 products → 30-day calendar
  it("returns parsed calendar days on the happy path (3 products)", async () => {
    const { generateCalendar } = await import("@/lib/actions/calendar");

    const result = await generateCalendar(makeFormData());

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual(MOCK_CALENDAR_30);
    // All 3 products must have been fetched via .in(...)
    expect(mockProductsIn).toHaveBeenCalledTimes(1);
    // The model must be called exactly once in JSON mode
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    const callArgs = mockGenerateText.mock.calls[0]?.[0] as {
      jsonMode?: boolean;
      prompt: string;
    };
    expect(callArgs.jsonMode).toBe(true);
  });

  // 2. Usage limit reached
  it("returns error when usage limit is reached", async () => {
    mockCheckAndIncrementUsage.mockResolvedValue({
      allowed: false,
      remaining: 0,
    });
    const { generateCalendar } = await import("@/lib/actions/calendar");

    const result = await generateCalendar(makeFormData());

    expect(result.data).toBeUndefined();
    expect(result.error).toMatch(/batas|limit/i);
    expect(mockGenerateText).not.toHaveBeenCalled();
    expect(mockProductsIn).not.toHaveBeenCalled();
  });

  // 3. Not signed in
  it("returns error when user is not signed in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const { generateCalendar } = await import("@/lib/actions/calendar");

    const result = await generateCalendar(makeFormData());

    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(mockCheckAndIncrementUsage).not.toHaveBeenCalled();
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  // 4. Invalid JSON
  it("returns error when the AI response is not valid JSON", async () => {
    mockGenerateText.mockResolvedValue({
      content: "bukan json { broken",
      tokensUsed: 100,
      durationMs: 500,
      model: "test-model",
    });
    const { generateCalendar } = await import("@/lib/actions/calendar");

    const result = await generateCalendar(makeFormData());

    expect(result.data).toBeUndefined();
    expect(result.error).toMatch(/tidak valid|invalid/i);
    // Insertion must NOT happen when AI output is garbage
    expect(mockInsert).not.toHaveBeenCalled();
  });

  // 5. No products found
  it("returns error when no products match the requested ids", async () => {
    mockProductsIn.mockResolvedValue({ data: [], error: null });
    const { generateCalendar } = await import("@/lib/actions/calendar");

    const result = await generateCalendar(makeFormData());

    expect(result.data).toBeUndefined();
    expect(result.error).toMatch(/tidak ditemukan/i);
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  // 6. Zod validation fails
  it("returns error when Zod validation fails (invalid month)", async () => {
    const { generateCalendar } = await import("@/lib/actions/calendar");

    // month=13 is out of range (1-12) — Zod must reject this.
    const result = await generateCalendar(makeFormData({ month: "13" }));

    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(mockProductsIn).not.toHaveBeenCalled();
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  // 7. Saves to generations with module: "calendar"
  it("inserts the calendar generation with module 'calendar'", async () => {
    const { generateCalendar } = await import("@/lib/actions/calendar");

    const result = await generateCalendar(makeFormData());

    expect(result.error).toBeUndefined();
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const inserted = mockInsert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(inserted.module).toBe("calendar");
    expect(inserted.user_id).toBe(MOCK_USER.id);
    expect(inserted.status).toBe("completed");
    // The full calendar array must be persisted in `result` for history.
    expect(inserted.result).toEqual(MOCK_CALENDAR_30);
  });

  // 8. Edge case — different month (February = 28 days)
  it("builds a prompt for a different month and persists a 28-day calendar", async () => {
    mockGenerateText.mockResolvedValue({
      content: JSON.stringify(MOCK_CALENDAR_28),
      tokensUsed: 3900,
      durationMs: 4800,
      model: "test-model",
    });
    const { generateCalendar } = await import("@/lib/actions/calendar");

    const result = await generateCalendar(
      makeFormData({ month: "2", year: "2026" }),
    );

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual(MOCK_CALENDAR_28);
    expect(result.data).toHaveLength(28);

    // Prompt must mention February in Bahasa Indonesia
    const callArgs = mockGenerateText.mock.calls[0]?.[0] as { prompt: string };
    expect(callArgs.prompt).toMatch(/Februari/);

    // Insertion must still happen with module: "calendar"
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const inserted = mockInsert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(inserted.module).toBe("calendar");
  });
});
