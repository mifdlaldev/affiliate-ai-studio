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

const MOCK_USER = { id: "user-101", email: "creator@example.com" };

const MOCK_PRODUCT = {
  id: "44444444-4444-4444-8444-444444444444",
  name: "Serum Vitamin C Premium",
  category: "kecantikan",
  brand: "GlowLab",
  price: "Rp 150.000",
  target_market: "Wanita 25-35",
  usp: "Mengandung 20% Vitamin C murni",
  benefits: "Mencerahkan kulit dalam 14 hari",
};

const MOCK_MODEL_PROMPTS = [
  {
    title: "Elegant wanita dewasa showcasing produk",
    prompt:
      "Editorial model photography of an Indonesian woman in her early 30s holding a premium vitamin C serum bottle, soft smile, casual linen blouse, natural daylight, clean minimal background, photorealistic, ultra detailed, 8k, --ar 1:1",
    style: "minimalist",
    mood: "warm",
    setting: "studio",
    composition: "hero",
    aspectRatio: "1:1",
    lighting: "cahaya alami soft",
    colorPalette: "earthy tone",
    cameraAngle: "eye-level",
    modelDescription:
      "Indonesian woman in her early 30s, elegant posture, soft smile, wearing casual linen blouse, holding the serum bottle delicately with both hands",
  },
  {
    title: "Casual pria dewasa lifestyle shot",
    prompt:
      "Lifestyle model photography of an Indonesian man in his late 20s applying vitamin C serum in a bright modern bathroom, relaxed pose, white t-shirt, golden hour, photorealistic, 8k, --ar 4:5",
    style: "lifestyle",
    mood: "natural",
    setting: "lifestyle",
    composition: "lifestyle",
    aspectRatio: "4:5",
    lighting: "golden hour warm",
    colorPalette: "pastel lembut",
    cameraAngle: "eye-level",
    modelDescription:
      "Indonesian man in his late 20s, casual relaxed vibe, wearing white cotton t-shirt, holding serum bottle near his face, soft natural smile",
  },
];

function makeFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("productId", overrides.productId ?? MOCK_PRODUCT.id);
  fd.set("style", overrides.style ?? "minimalist");
  fd.set("mood", overrides.mood ?? "warm");
  fd.set("setting", overrides.setting ?? "studio");
  fd.set("composition", overrides.composition ?? "hero");
  fd.set("gender", overrides.gender ?? "wanita");
  fd.set("age", overrides.age ?? "dewasa");
  fd.set("modelVibe", overrides.modelVibe ?? "elegan");
  return fd;
}

// ---- Tests -----------------------------------------------------------------

describe("generateModelPrompts Server Action", () => {
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
      content: JSON.stringify(MOCK_MODEL_PROMPTS),
      tokensUsed: 520,
      durationMs: 1800,
      model: "test-model",
    });
  });

  // 1. Happy path
  it("returns parsed model prompts on the happy path", async () => {
    const { generateModelPrompts } = await import("@/lib/actions/models");

    const result = await generateModelPrompts(makeFormData());

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual(MOCK_MODEL_PROMPTS);
  });

  // 2. Usage limit reached
  it("returns error when usage limit is reached", async () => {
    mockCheckAndIncrementUsage.mockResolvedValue({
      allowed: false,
      remaining: 0,
    });
    const { generateModelPrompts } = await import("@/lib/actions/models");

    const result = await generateModelPrompts(makeFormData());

    expect(result.data).toBeUndefined();
    expect(result.error).toMatch(/batas|limit/i);
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  // 3. Not signed in
  it("returns error when user is not signed in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const { generateModelPrompts } = await import("@/lib/actions/models");

    const result = await generateModelPrompts(makeFormData());

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
    const { generateModelPrompts } = await import("@/lib/actions/models");

    const result = await generateModelPrompts(makeFormData());

    expect(result.data).toBeUndefined();
    expect(result.error).toMatch(/tidak valid|invalid/i);
  });

  // 5. Product not found
  it("returns error when the product is not found", async () => {
    mockProductSingle.mockResolvedValue({
      data: null,
      error: { message: "Not found" },
    });
    const { generateModelPrompts } = await import("@/lib/actions/models");

    const result = await generateModelPrompts(makeFormData());

    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  // 6. Zod validation fails
  it("returns error when Zod validation fails (invalid gender)", async () => {
    const { generateModelPrompts } = await import("@/lib/actions/models");

    const result = await generateModelPrompts(makeFormData({ gender: "alien" }));

    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(mockCheckAndIncrementUsage).not.toHaveBeenCalled();
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  // 7. Saves to generations table
  it("inserts a generations row with the correct shape (module=model)", async () => {
    const { generateModelPrompts } = await import("@/lib/actions/models");

    await generateModelPrompts(makeFormData());

    expect(mockInsert).toHaveBeenCalledTimes(1);
    const inserted = mockInsert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(inserted.user_id).toBe(MOCK_USER.id);
    expect(inserted.module).toBe("model");
    expect(inserted.subtype).toBe("wanita");
    expect(inserted.status).toBe("completed");
    expect(typeof inserted.input_prompt).toBe("string");
    expect(Array.isArray(inserted.result)).toBe(true);
    expect((inserted.result as unknown[]).length).toBe(
      MOCK_MODEL_PROMPTS.length
    );
    expect(inserted.tokens_used).toBe(520);
    expect(inserted.duration_ms).toBe(1800);
    expect(inserted.model).toBe("test-model");
  });

  // 8. Edge case — different age
  it("accepts age='remaja' and forwards it to the model", async () => {
    const { generateModelPrompts } = await import("@/lib/actions/models");

    const result = await generateModelPrompts(makeFormData({ age: "remaja" }));

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual(MOCK_MODEL_PROMPTS);
    // The model must be called exactly once with the remaja-age prompt.
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    const callArgs = mockGenerateText.mock.calls[0]?.[0] as {
      prompt: string;
    };
    expect(callArgs.prompt).toMatch(/remaja/);
    // The insertion must record the chosen gender as the subtype.
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const inserted = mockInsert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(inserted.subtype).toBe("wanita");
  });
});
