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

const MOCK_USER = { id: "user-789", email: "creator@example.com" };

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

const MOCK_PHOTO_PROMPTS = [
  {
    title: "Hero shot angle 45 derajat",
    prompt:
      "Editorial product photography of a premium vitamin C serum bottle, 45-degree angle, soft natural daylight, clean minimal background, dewy texture, vibrant orange liquid, photorealistic, ultra detailed, 8k, --ar 1:1",
    style: "minimalist",
    mood: "warm",
    setting: "studio",
    composition: "hero",
    aspectRatio: "1:1",
    lighting: "cahaya alami soft",
    colorPalette: "earthy tone",
    cameraAngle: "45 derajat dari atas",
  },
  {
    title: "Close-up ingredient macro",
    prompt:
      "Extreme close-up macro shot of a golden vitamin C serum drop, studio lighting with rim light, water droplets, glossy texture, editorial product photography, ultra detailed, 8k, --ar 4:5",
    style: "minimalist",
    mood: "warm",
    setting: "studio",
    composition: "close-up",
    aspectRatio: "4:5",
    lighting: "studio lighting dengan rim light",
    colorPalette: "monokromatik",
    cameraAngle: "eye-level",
  },
  {
    title: "Lifestyle flat-lay penggunaan",
    prompt:
      "Top-down flat-lay of a woman hands applying vitamin C serum on face, morning routine, soft golden hour warm light, cozy bedroom setting, lifestyle photography, natural and warm mood, 8k, --ar 1:1",
    style: "minimalist",
    mood: "warm",
    setting: "studio",
    composition: "flat-lay",
    aspectRatio: "1:1",
    lighting: "golden hour warm",
    colorPalette: "earthy tone",
    cameraAngle: "top-down flat lay",
  },
];

function makeFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("productId", overrides.productId ?? MOCK_PRODUCT.id);
  fd.set("style", overrides.style ?? "minimalist");
  fd.set("mood", overrides.mood ?? "warm");
  fd.set("setting", overrides.setting ?? "studio");
  fd.set("composition", overrides.composition ?? "hero");
  return fd;
}

// ---- Tests -----------------------------------------------------------------

describe("generatePhotoPrompts Server Action", () => {
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
      content: JSON.stringify(MOCK_PHOTO_PROMPTS),
      tokensUsed: 420,
      durationMs: 1500,
      model: "test-model",
    });
  });

  // 1. Happy path
  it("returns parsed photo prompts on the happy path", async () => {
    const { generatePhotoPrompts } = await import("@/lib/actions/photos");

    const result = await generatePhotoPrompts(makeFormData());

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual(MOCK_PHOTO_PROMPTS);
  });

  // 2. Usage limit reached
  it("returns error when usage limit is reached", async () => {
    mockCheckAndIncrementUsage.mockResolvedValue({
      allowed: false,
      remaining: 0,
    });
    const { generatePhotoPrompts } = await import("@/lib/actions/photos");

    const result = await generatePhotoPrompts(makeFormData());

    expect(result.data).toBeUndefined();
    expect(result.error).toMatch(/batas|limit/i);
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  // 3. Not signed in
  it("returns error when user is not signed in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const { generatePhotoPrompts } = await import("@/lib/actions/photos");

    const result = await generatePhotoPrompts(makeFormData());

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
    const { generatePhotoPrompts } = await import("@/lib/actions/photos");

    const result = await generatePhotoPrompts(makeFormData());

    expect(result.data).toBeUndefined();
    expect(result.error).toMatch(/tidak valid|invalid/i);
  });

  // 5. Product not found
  it("returns error when the product is not found", async () => {
    mockProductSingle.mockResolvedValue({
      data: null,
      error: { message: "Not found" },
    });
    const { generatePhotoPrompts } = await import("@/lib/actions/photos");

    const result = await generatePhotoPrompts(makeFormData());

    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  // 6. Zod validation fails
  it("returns error when Zod validation fails (invalid style)", async () => {
    const { generatePhotoPrompts } = await import("@/lib/actions/photos");

    const result = await generatePhotoPrompts(
      makeFormData({ style: "bogus-style" })
    );

    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(mockCheckAndIncrementUsage).not.toHaveBeenCalled();
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  // 7. Saves to generations table
  it("inserts a generations row with the correct shape (module=photo)", async () => {
    const { generatePhotoPrompts } = await import("@/lib/actions/photos");

    await generatePhotoPrompts(makeFormData());

    expect(mockInsert).toHaveBeenCalledTimes(1);
    const inserted = mockInsert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(inserted.user_id).toBe(MOCK_USER.id);
    expect(inserted.module).toBe("photo");
    expect(inserted.subtype).toBe("minimalist");
    expect(inserted.status).toBe("completed");
    expect(typeof inserted.input_prompt).toBe("string");
    expect(Array.isArray(inserted.result)).toBe(true);
    expect((inserted.result as unknown[]).length).toBe(
      MOCK_PHOTO_PROMPTS.length
    );
    expect(inserted.tokens_used).toBe(420);
    expect(inserted.duration_ms).toBe(1500);
    expect(inserted.model).toBe("test-model");
  });

  // 8. Edge case — different style
  it("accepts style='creative' and forwards it to the model", async () => {
    const { generatePhotoPrompts } = await import("@/lib/actions/photos");

    const result = await generatePhotoPrompts(
      makeFormData({ style: "creative" })
    );

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual(MOCK_PHOTO_PROMPTS);
    // The model must be called exactly once with the creative-style prompt.
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    const callArgs = mockGenerateText.mock.calls[0]?.[0] as {
      prompt: string;
    };
    expect(callArgs.prompt).toMatch(/Style: creative/);
    // The insertion must record the chosen style as the subtype.
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const inserted = mockInsert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(inserted.subtype).toBe("creative");
  });
});
