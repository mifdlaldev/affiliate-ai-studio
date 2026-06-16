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

const MOCK_HOOKS = [
  {
    text: "Hook 1",
    platform: "tiktok",
    tone: "casual",
    note: "FOMO opener",
  },
  {
    text: "Hook 2",
    platform: "tiktok",
    tone: "casual",
    note: "Question style",
  },
  {
    text: "Hook 3",
    platform: "tiktok",
    tone: "casual",
    note: "Storytelling",
  },
];

function makeFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("productId", overrides.productId ?? MOCK_PRODUCT.id);
  fd.set("platform", overrides.platform ?? "tiktok");
  fd.set("tone", overrides.tone ?? "casual");
  fd.set("audience", overrides.audience ?? "Wanita 20-35");
  return fd;
}

// ---- Tests -----------------------------------------------------------------

describe("generateHooks Server Action", () => {
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
      content: JSON.stringify(MOCK_HOOKS),
      tokensUsed: 100,
      durationMs: 500,
      model: "test-model",
    });
  });

  it("returns parsed hooks on the happy path", async () => {
    const { generateHooks } = await import("@/lib/actions/hooks");

    const result = await generateHooks(makeFormData());

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual(MOCK_HOOKS);
  });

  it("checks usage exactly once with the signed-in user id", async () => {
    const { generateHooks } = await import("@/lib/actions/hooks");

    await generateHooks(makeFormData());

    expect(mockCheckAndIncrementUsage).toHaveBeenCalledTimes(1);
    expect(mockCheckAndIncrementUsage).toHaveBeenCalledWith(MOCK_USER.id);
  });

  it("calls generateText with systemPrompt, prompt, and jsonMode: true", async () => {
    const { generateHooks } = await import("@/lib/actions/hooks");

    await generateHooks(makeFormData());

    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    const callArgs = mockGenerateText.mock.calls[0]?.[0] as {
      systemPrompt: string;
      prompt: string;
      jsonMode: boolean;
    };
    expect(callArgs.systemPrompt).toBeDefined();
    expect(typeof callArgs.systemPrompt).toBe("string");
    expect(callArgs.prompt).toBeDefined();
    expect(typeof callArgs.prompt).toBe("string");
    expect(callArgs.jsonMode).toBe(true);
  });

  it("inserts a generations row with the correct shape", async () => {
    const { generateHooks } = await import("@/lib/actions/hooks");

    await generateHooks(makeFormData());

    expect(mockInsert).toHaveBeenCalledTimes(1);
    const inserted = mockInsert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(inserted.user_id).toBe(MOCK_USER.id);
    expect(inserted.module).toBe("hook");
    expect(inserted.subtype).toBe("tiktok");
    expect(inserted.status).toBe("completed");
    expect(typeof inserted.input_prompt).toBe("string");
    expect(Array.isArray(inserted.result)).toBe(true);
    expect((inserted.result as unknown[]).length).toBe(MOCK_HOOKS.length);
    expect(inserted.tokens_used).toBe(100);
    expect(inserted.duration_ms).toBe(500);
    expect(inserted.model).toBe("test-model");
  });

  // ---- Edge cases --------------------------------------------------------

  it("returns error when user is not signed in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const { generateHooks } = await import("@/lib/actions/hooks");

    const result = await generateHooks(makeFormData());

    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(mockCheckAndIncrementUsage).not.toHaveBeenCalled();
  });

  it("returns error when usage limit is reached", async () => {
    mockCheckAndIncrementUsage.mockResolvedValue({
      allowed: false,
      remaining: 0,
    });
    const { generateHooks } = await import("@/lib/actions/hooks");

    const result = await generateHooks(makeFormData());

    expect(result.data).toBeUndefined();
    expect(result.error).toMatch(/batas|limit/i);
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it("returns error when the product is not found", async () => {
    mockProductSingle.mockResolvedValue({
      data: null,
      error: { message: "Not found" },
    });
    const { generateHooks } = await import("@/lib/actions/hooks");

    const result = await generateHooks(makeFormData());

    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it("returns error when the AI response is not valid JSON", async () => {
    mockGenerateText.mockResolvedValue({
      content: "not json at all",
      tokensUsed: 50,
      durationMs: 200,
      model: "test-model",
    });
    const { generateHooks } = await import("@/lib/actions/hooks");

    const result = await generateHooks(makeFormData());

    expect(result.data).toBeUndefined();
    expect(result.error).toMatch(/tidak valid|invalid/i);
  });
});
