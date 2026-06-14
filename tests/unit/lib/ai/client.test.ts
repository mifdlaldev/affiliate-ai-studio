import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mock the OpenAI SDK at the module level. The OpenAI client only exposes
 * `post` for the chat completions endpoint in our codebase, so the mock
 * surface is small. We use a hoisted variable so the `vi.mock` factory can
 * close over it. The `default` export must be constructable (i.e. a regular
 * `function`, not an arrow) because `client.ts` evaluates `new OpenAI(...)`
 * at module load time.
 */
const mockPost = vi.hoisted(() => vi.fn());

vi.mock("openai", () => ({
  default: vi.fn(function () {
    return { post: mockPost };
  }),
}));

import {
  AI_CONFIG,
  VISION_MODEL,
  VISION_REASONING_EFFORT,
  getNextProvider,
} from "@/lib/ai/config";
import { generateText } from "@/lib/ai/client";

function mockChatResponse(content: string, totalTokens = 100) {
  return {
    id: "chatcmpl-test",
    object: "chat.completion",
    created: 0,
    model: "test",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 10,
      total_tokens: totalTokens,
    },
  };
}

describe("AI_CONFIG", () => {
  it("has a primary provider configured", () => {
    expect(AI_CONFIG.primary).toBeDefined();
    expect(AI_CONFIG.primary.baseURL).toBeTruthy();
    expect(AI_CONFIG.primary.model).toBe("deepseek-v4-flash-free");
  });

  it("primary provider has expected defaults", () => {
    expect(AI_CONFIG.primary.baseURL).toBe("https://opencode.ai/zen/v1");
    expect(AI_CONFIG.primary.reasoning).toBe("max");
    expect(AI_CONFIG.primary.cost).toBe("FREE");
  });

  it("has at least one fallback provider", () => {
    expect(AI_CONFIG.fallbacks.length).toBeGreaterThan(0);
  });

  it("fallback providers have unique names", () => {
    const names = AI_CONFIG.fallbacks.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("getNextProvider", () => {
  it("returns first fallback when current is primary", () => {
    const next = getNextProvider(AI_CONFIG.primary.name);
    expect(next).toBe(AI_CONFIG.fallbacks[0]);
  });

  it("returns the next fallback when current is a fallback", () => {
    if (AI_CONFIG.fallbacks.length >= 2) {
      const current = AI_CONFIG.fallbacks[0];
      const expected = AI_CONFIG.fallbacks[1];
      const next = getNextProvider(current.name);
      expect(next).toBe(expected);
    }
  });

  it("returns null when no more fallbacks", () => {
    const lastFallback = AI_CONFIG.fallbacks[AI_CONFIG.fallbacks.length - 1];
    if (lastFallback) {
      expect(getNextProvider(lastFallback.name)).toBeNull();
    }
  });

  it("returns first fallback for unknown provider name", () => {
    // Unknown names should still hand back something useful so callers can
    // attempt recovery rather than silently giving up.
    const next = getNextProvider("Definitely Not A Real Provider");
    expect(next).toBe(AI_CONFIG.fallbacks[0]);
  });
});

describe("VISION_MODEL", () => {
  it("points to the OpenCode Zen free vision model", () => {
    // If this changes, update AGENTS.md + docs. MiMo-V2.5 is verified to
    // support native image input (729M-param ViT encoder) and is free on
    // OpenCode Zen as of April 2026.
    expect(VISION_MODEL).toBe("mimo-v2.5-free");
  });
});

describe("VISION_REASONING_EFFORT", () => {
  it("is a value MiMo-V2.5 accepts via OpenCode Zen", () => {
    // MiMo's allowed set: xhigh | high | medium | low | minimal | none.
    // The primary provider's default "max" is rejected with 400 — guard
    // against regression by asserting we use a value the model accepts.
    expect(VISION_REASONING_EFFORT).toBe("high");
  });
});

describe("generateText with vision (imageUrl)", () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it("sends image_url content part when imageUrl is provided", async () => {
    mockPost.mockResolvedValueOnce(
      mockChatResponse('{"name":"Test Product"}'),
    );

    const result = await generateText({
      prompt: "Analyze this product",
      systemPrompt: "You are a product analyst",
      imageUrl: "data:image/jpeg;base64,QUJD",
      jsonMode: true,
      model: VISION_MODEL,
    });

    expect(result.content).toBe('{"name":"Test Product"}');
    expect(mockPost).toHaveBeenCalledTimes(1);
    const [, options] = mockPost.mock.calls[0]!;
    expect(options).toBeDefined();
    expect(options.body.model).toBe("mimo-v2.5-free");
    expect(options.body.response_format).toEqual({ type: "json_object" });
    const userMsg = options.body.messages.find(
      (m: { role: string }) => m.role === "user",
    );
    expect(Array.isArray(userMsg.content)).toBe(true);
    expect(userMsg.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "text", text: "Analyze this product" }),
        expect.objectContaining({
          type: "image_url",
          image_url: { url: "data:image/jpeg;base64,QUJD" },
        }),
      ]),
    );
  });

  it("keeps string content when no imageUrl is provided (regression)", async () => {
    mockPost.mockResolvedValueOnce(mockChatResponse("ok"));

    await generateText({
      prompt: "Hello",
      systemPrompt: "You are helpful",
    });

    const [, options] = mockPost.mock.calls[0]!;
    const userMsg = options.body.messages.find(
      (m: { role: string }) => m.role === "user",
    );
    expect(typeof userMsg.content).toBe("string");
    expect(userMsg.content).toBe("Hello");
  });
});

describe("generateText reasoning pass-through", () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it("forwards explicit reasoning override to the request body", async () => {
    mockPost.mockResolvedValueOnce(mockChatResponse("ok"));

    await generateText({
      prompt: "x",
      reasoning: "high",
    });

    const [, options] = mockPost.mock.calls[0]!;
    expect(options.body.reasoning_effort).toBe("high");
  });

  it("uses provider default reasoning when none is specified", async () => {
    mockPost.mockResolvedValueOnce(mockChatResponse("ok"));

    await generateText({ prompt: "x" });

    const [, options] = mockPost.mock.calls[0]!;
    // Primary provider's default is "max" — DeepSeek-V4-Flash-specific.
    expect(options.body.reasoning_effort).toBe("max");
  });

  it("vision call uses VISION_REASONING_EFFORT (not provider default 'max')", async () => {
    mockPost.mockResolvedValueOnce(
      mockChatResponse('{"name":"Test Product"}'),
    );

    await generateText({
      prompt: "Analyze this product",
      imageUrl: "data:image/jpeg;base64,QUJD",
      jsonMode: true,
      model: VISION_MODEL,
      reasoning: VISION_REASONING_EFFORT,
    });

    const [, options] = mockPost.mock.calls[0]!;
    expect(options.body.model).toBe("mimo-v2.5-free");
    expect(options.body.reasoning_effort).toBe(VISION_REASONING_EFFORT);
  });
});
