import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  GenerateUgcScriptResult,
  GenerateUgcStoryboardResult,
  GenerateUgcPromptResult,
  GenerateUgcBatchResult,
} from "@/lib/actions/ugc";

// Module-level mock fns (referenced by the `vi.mock` factory bodies below).
// vitest hoists `vi.mock` above the `const` declarations at runtime, but the
// factory functions are not invoked until the module is first imported — by
// that point these bindings are already initialised, so the reference is safe.
const mockGetUser = vi.fn();
const mockProductSingle = vi.fn();
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
            // Script / Storyboard / Prompt fetch ONE product via .single()
            eq: () => ({
              single: () => mockProductSingle(),
            }),
            // Batch fetches MULTIPLE products via .in("id", productIds)
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

const MOCK_PRODUCTS = [
  MOCK_PRODUCT,
  {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Sunscreen SPF 50+ Daily",
    category: "kecantikan",
    brand: "GlowLab",
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    name: "Moisturizer Light Gel",
    category: "kecantikan",
    brand: "GlowLab",
  },
];

// Sub-module 1 — Script
const MOCK_SCRIPT = {
  title: "Review jujur setelah 2 minggu",
  text: "Aku udah pakai serum ini 2 minggu dan hasilnya bikin kaget. Kulit terasa lebih cerah dan halus, noda hitam mulai pudar. Cuma packagingnya agak besar ya, gak terlalu travel-friendly. Overall worth it sih, bakal repurchase.",
};

// Sub-module 2 — Storyboard (array of panels)
const MOCK_STORYBOARD = [
  {
    panel: 1,
    time: "0-3s",
    visuals: "Talent ngangkat produk ke kamera, pencahayaan natural kamar",
    audio: "Oke jadi ini serum yang lagi viral banget",
    text: "Review jujur GlowLab",
  },
  {
    panel: 2,
    time: "3-12s",
    visuals: "Talent buka kemasan, teteskan serum ke tangan",
    audio: "Awalnya ragu karena harganya lumayan",
    text: "",
  },
  {
    panel: 3,
    time: "12-22s",
    visuals: "Close-up oles ke wajah, ekspresi fokus",
    audio: "Tapi pas dipake tuh berasa banget di kulit",
    text: "Hari ke-1",
  },
  {
    panel: 4,
    time: "22-30s",
    visuals: "Before/after split screen, senyum puas",
    audio: "2 minggu kemudian, ini hasilnya. Kalo penasaran cek keranjang kuning ya",
    text: "Hasil 2 minggu",
  },
];

// Sub-module 3 — Prompt (array of image-prompt objects)
const MOCK_PROMPTS = [
  {
    title: "Selfie candid pagi hari",
    prompt:
      "Young Indonesian woman taking a selfie with a Vitamin C serum bottle, handheld phone camera, natural morning window light, casual bedroom background, candid smile, no makeup look, phone visible in hand, realistic phone photo style, soft warm tones",
    style: "selfie",
    mood: "happy",
  },
  {
    title: "Unboxing pertama kali",
    prompt:
      "Indonesian woman unboxing a skincare serum package on a wooden desk, hands holding the product, excited expression, smartphone camera angle, natural daylight from window, casual home setting, realistic phone photo style, cozy warm tones",
    style: "unboxing",
    mood: "excited",
  },
  {
    title: "Review angle depan kamera",
    prompt:
      "Indonesian woman in casual t-shirt holding a serum bottle up to camera, talking gesture, bedroom background with soft lamp light, handheld phone camera, confident smile, realistic phone photo style, natural skin texture, candid",
    style: "review",
    mood: "satisfied",
  },
];

// Sub-module 4 — Batch (array of { title, text }, one per product)
const MOCK_BATCH = [
  {
    title: "Review jujur serum GlowLab",
    text: "Aku udah pakai serum ini 2 minggu...",
  },
  {
    title: "Tas kulit yang lagi hits",
    text: "Beli tas ini karena review-nya bagus...",
  },
  {
    title: "Kopi Aceh yang bikin nagih",
    text: "Pecinta kopi wajib coba ini...",
  },
];

const MOCK_AI_RESULT = {
  content: "{}",
  tokensUsed: 1234,
  durationMs: 5000,
  model: "deepseek-v4",
};

// ---- FormData helpers -----------------------------------------------------

interface ScriptFormOverrides {
  productId?: string;
  platform?: string;
  tone?: string;
  audience?: string;
}

function makeScriptFormData(overrides: ScriptFormOverrides = {}): FormData {
  const fd = new FormData();
  fd.set("productId", overrides.productId ?? MOCK_PRODUCT.id);
  fd.set("platform", overrides.platform ?? "tiktok");
  fd.set("tone", overrides.tone ?? "casual");
  fd.set("audience", overrides.audience ?? "Wanita 20-35");
  return fd;
}

interface StoryboardFormOverrides {
  productId?: string;
  platform?: string;
  tone?: string;
}

function makeStoryboardFormData(
  overrides: StoryboardFormOverrides = {},
): FormData {
  const fd = new FormData();
  fd.set("productId", overrides.productId ?? MOCK_PRODUCT.id);
  fd.set("platform", overrides.platform ?? "tiktok");
  fd.set("tone", overrides.tone ?? "casual");
  return fd;
}

interface PromptFormOverrides {
  productId?: string;
  style?: string;
  mood?: string;
}

function makePromptFormData(overrides: PromptFormOverrides = {}): FormData {
  const fd = new FormData();
  fd.set("productId", overrides.productId ?? MOCK_PRODUCT.id);
  fd.set("style", overrides.style ?? "selfie");
  fd.set("mood", overrides.mood ?? "happy");
  return fd;
}

interface BatchFormOverrides {
  productIds?: string[];
  platform?: string;
  tone?: string;
}

function makeBatchFormData(overrides: BatchFormOverrides = {}): FormData {
  const fd = new FormData();
  const ids = overrides.productIds ?? MOCK_PRODUCTS.map((p) => p.id);
  for (const id of ids) fd.append("productIds", id);
  fd.set("platform", overrides.platform ?? "tiktok");
  fd.set("tone", overrides.tone ?? "casual");
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
  mockProductsIn.mockResolvedValue({ data: MOCK_PRODUCTS, error: null });
  mockInsert.mockResolvedValue({ error: null });
  mockGenerateText.mockResolvedValue(MOCK_AI_RESULT);
});

// ============================================================================
// Sub-module 1: UGC Script (3 tests)
// ============================================================================

describe("generateUgcScript", () => {
  it("returns the parsed script and persists the generation on success", async () => {
    const { generateUgcScript } = await import("@/lib/actions/ugc");
    mockGenerateText.mockResolvedValue({
      ...MOCK_AI_RESULT,
      content: JSON.stringify(MOCK_SCRIPT),
    });

    const result = await generateUgcScript(makeScriptFormData());

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual(MOCK_SCRIPT);

    // The model must be called in JSON mode.
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    const callArgs = mockGenerateText.mock.calls[0]?.[0] as {
      jsonMode: boolean;
      systemPrompt: string;
      prompt: string;
    };
    expect(callArgs.jsonMode).toBe(true);
    expect(callArgs.systemPrompt).toMatch(/UGC|testimoni|review/i);
    // Product name + platform + tone must all be in the prompt.
    expect(callArgs.prompt).toContain(MOCK_PRODUCT.name);
    expect(callArgs.prompt).toContain("tiktok");
    expect(callArgs.prompt).toContain("casual");

    // Insertion must happen with module: "ugc-script" + subtype = platform.
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const inserted = mockInsert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(inserted.module).toBe("ugc-script");
    expect(inserted.subtype).toBe("tiktok");
    expect(inserted.status).toBe("completed");
  });

  it("returns error when usage limit is reached", async () => {
    const { generateUgcScript } = await import("@/lib/actions/ugc");
    mockCheckAndIncrementUsage.mockResolvedValue({
      allowed: false,
      remaining: 0,
    });

    const result = await generateUgcScript(makeScriptFormData());

    expect(result.error).toMatch(/batas|limit/i);
    expect(result.data).toBeUndefined();
    // AI must NOT be called when limit is hit.
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it("returns error when Zod validation fails (invalid platform)", async () => {
    const { generateUgcScript } = await import("@/lib/actions/ugc");

    const result = await generateUgcScript(
      makeScriptFormData({ platform: "myspace" }),
    );

    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
    // AI must NOT be called when validation fails.
    expect(mockGenerateText).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Sub-module 2: UGC Storyboard (3 tests)
// ============================================================================

describe("generateUgcStoryboard", () => {
  it("returns the parsed storyboard panels and persists the generation on success", async () => {
    const { generateUgcStoryboard } = await import("@/lib/actions/ugc");
    mockGenerateText.mockResolvedValue({
      ...MOCK_AI_RESULT,
      content: JSON.stringify(MOCK_STORYBOARD),
    });

    const result = await generateUgcStoryboard(makeStoryboardFormData());

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual(MOCK_STORYBOARD);
    expect(result.data).toHaveLength(4);

    // JSON mode + UGC storyboard system prompt
    const callArgs = mockGenerateText.mock.calls[0]?.[0] as {
      jsonMode: boolean;
      systemPrompt: string;
    };
    expect(callArgs.jsonMode).toBe(true);
    expect(callArgs.systemPrompt).toMatch(/storyboard|panel/i);

    // Insertion with module: "ugc-storyboard"
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const inserted = mockInsert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(inserted.module).toBe("ugc-storyboard");
    expect(inserted.subtype).toBe("tiktok");
  });

  it("returns error when the AI response is not valid JSON", async () => {
    const { generateUgcStoryboard } = await import("@/lib/actions/ugc");
    mockGenerateText.mockResolvedValue({
      ...MOCK_AI_RESULT,
      content: "this is not json {{{ broken",
    });

    const result = await generateUgcStoryboard(makeStoryboardFormData());

    expect(result.error).toMatch(/tidak valid|invalid/i);
    expect(result.data).toBeUndefined();
    // We log the bad response for debugging, but the user gets a friendly error.
  });

  it("returns error when the product is not found", async () => {
    const { generateUgcStoryboard } = await import("@/lib/actions/ugc");
    mockProductSingle.mockResolvedValue({
      data: null,
      error: { message: "Not found" },
    });

    const result = await generateUgcStoryboard(makeStoryboardFormData());

    expect(result.error).toMatch(/tidak ditemukan/i);
    expect(result.data).toBeUndefined();
    // AI must NOT be called when the product is missing.
    expect(mockGenerateText).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Sub-module 3: UGC Prompt (3 tests)
// ============================================================================

describe("generateUgcPrompt", () => {
  it("returns the parsed image-prompts and persists the generation on success", async () => {
    const { generateUgcPrompt } = await import("@/lib/actions/ugc");
    mockGenerateText.mockResolvedValue({
      ...MOCK_AI_RESULT,
      content: JSON.stringify(MOCK_PROMPTS),
    });

    const result = await generateUgcPrompt(makePromptFormData());

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual(MOCK_PROMPTS);
    expect(result.data).toHaveLength(3);

    // JSON mode + UGC prompt system prompt
    const callArgs = mockGenerateText.mock.calls[0]?.[0] as {
      jsonMode: boolean;
      systemPrompt: string;
    };
    expect(callArgs.jsonMode).toBe(true);
    expect(callArgs.systemPrompt).toMatch(/UGC|phone|handheld/i);

    // Insertion with module: "ugc-prompt" + subtype = style
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const inserted = mockInsert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(inserted.module).toBe("ugc-prompt");
    expect(inserted.subtype).toBe("selfie");
  });

  it("returns error when the user is not signed in", async () => {
    const { generateUgcPrompt } = await import("@/lib/actions/ugc");
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await generateUgcPrompt(makePromptFormData());

    expect(result.error).toMatch(/login/i);
    expect(result.data).toBeUndefined();
    // AI must NOT be called when user is not signed in.
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it("returns error when Zod validation fails (invalid style)", async () => {
    const { generateUgcPrompt } = await import("@/lib/actions/ugc");

    const result = await generateUgcPrompt(
      makePromptFormData({ style: "cinematic-bokeh" }),
    );

    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
    // AI must NOT be called when validation fails.
    expect(mockGenerateText).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Sub-module 4: UGC Batch (3 tests)
// ============================================================================

describe("generateUgcBatch", () => {
  it("returns one parsed script per product and persists the generation on success", async () => {
    const { generateUgcBatch } = await import("@/lib/actions/ugc");
    mockGenerateText.mockResolvedValue({
      ...MOCK_AI_RESULT,
      content: JSON.stringify(MOCK_BATCH),
    });

    const result = await generateUgcBatch(makeBatchFormData());

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual(MOCK_BATCH);
    expect(result.data).toHaveLength(MOCK_PRODUCTS.length);

    // JSON mode + UGC batch system prompt must mention "satu"/"tiap"/
    // "per product" to convey the 1-script-per-product rule.
    const callArgs = mockGenerateText.mock.calls[0]?.[0] as {
      jsonMode: boolean;
      systemPrompt: string;
      prompt: string;
    };
    expect(callArgs.jsonMode).toBe(true);
    expect(callArgs.systemPrompt).toMatch(/satu|tiap|setiap|per product|per produk/i);
    // Every product name must appear in the prompt.
    for (const p of MOCK_PRODUCTS) {
      expect(callArgs.prompt).toContain(p.name);
    }

    // Insertion with module: "ugc-batch" + subtype = platform
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const inserted = mockInsert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(inserted.module).toBe("ugc-batch");
    expect(inserted.subtype).toBe("tiktok");
  });

  it("returns error when fewer than 2 productIds are submitted", async () => {
    const { generateUgcBatch } = await import("@/lib/actions/ugc");

    const result = await generateUgcBatch(
      makeBatchFormData({ productIds: [MOCK_PRODUCT.id] }),
    );

    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
    // AI must NOT be called when validation fails.
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it("returns error when more than 5 productIds are submitted", async () => {
    const { generateUgcBatch } = await import("@/lib/actions/ugc");

    const result = await generateUgcBatch(
      makeBatchFormData({
        productIds: [
          MOCK_PRODUCT.id,
          "55555555-5555-4555-8555-555555555555",
          "66666666-6666-4666-8666-666666666666",
          "77777777-7777-4777-8777-777777777777",
          "88888888-8888-4888-8888-888888888888",
          "99999999-9999-4999-8999-999999999999",
        ],
      }),
    );

    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
    // AI must NOT be called when validation fails.
    expect(mockGenerateText).not.toHaveBeenCalled();
  });
});

// ---- Type compile-check (catches missing exports) --------------------------

// If these types don't exist on the module, the test file fails to compile,
// which is itself a failing test. No runtime assertion needed.
const _typeCheck: {
  script: GenerateUgcScriptResult;
  storyboard: GenerateUgcStoryboardResult;
  prompt: GenerateUgcPromptResult;
  batch: GenerateUgcBatchResult;
} | null = null;
void _typeCheck;
