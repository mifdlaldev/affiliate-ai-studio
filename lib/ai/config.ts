export type ReasoningEffort = "max" | "high" | "low" | "non-thinking";

export interface AIProviderConfig {
  name: string;
  baseURL: string;
  apiKey: string;
  model: string;
  /** Optional reasoning effort (provider-specific). */
  reasoning?: ReasoningEffort;
  /** Human-readable cost label for the admin dashboard. */
  cost: string;
}

/**
 * Centralised AI provider configuration.
 *
 * Switching the primary provider or adding a new fallback only requires
 * editing this file — no business-logic changes elsewhere. See design
 * spec section 3.10 for the fallback strategy.
 */
export const AI_CONFIG = {
  primary: {
    name: "OpenCode Zen (DeepSeek V4 Flash Free)",
    baseURL: "https://opencode.ai/zen/v1",
    apiKey: process.env.OPENCODE_API_KEY ?? "",
    model: "deepseek-v4-flash-free",
    reasoning: "max",
    cost: "FREE",
  } as AIProviderConfig,
  fallbacks: [
    {
      name: "DeepSeek V4 Flash (paid via OpenCode Zen)",
      baseURL: "https://opencode.ai/zen/v1",
      apiKey: process.env.OPENCODE_API_KEY ?? "",
      model: "deepseek-v4-flash",
      reasoning: "max",
      cost: "$0.14 input / $0.28 output per 1M",
    },
    {
      name: "Kimchi.dev minimax-m2.7",
      baseURL: "https://api.kimchi.dev/v1",
      apiKey: process.env.KIMCHI_API_KEY ?? "",
      model: "minimax-m2.7",
      cost: "$0.30 input / $1.20 output per 1M",
    },
  ] as AIProviderConfig[],
};

/**
 * Vision-capable model on OpenCode Zen (free tier, April 2026).
 *
 * MiMo-V2.5 is a 310B/15B-active sparse MoE model from Xiaomi with a 729M-param
 * ViT encoder, supporting native image / video / audio understanding. It
 * accepts the OpenAI Chat Completions vision format (data URLs or HTTP URLs)
 * and runs on the same `opencode.ai/zen/v1/chat/completions` endpoint as our
 * primary text model.
 *
 * Replaces the old BLIP-2 / HuggingFace Inference API flow, which was
 * deprecated in 2024-2025.
 *
 * @see https://opencode.ai/docs/zen/#models
 * @see https://huggingface.co/XiaomiMiMo/MiMo-V2.5
 */
export const VISION_MODEL = "mimo-v2.5-free";

/**
 * Reasoning effort to use for `VISION_MODEL` calls.
 *
 * MiMo-V2.5 (via OpenCode Zen) accepts ONLY: `xhigh` | `high` | `medium` |
 * `low` | `minimal` | `none`. The primary provider's default (`"max"`) is
 * rejected with a 400 — that value is DeepSeek-V4-Flash-specific.
 *
 * `"high"` is a safe middle ground: still does chain-of-thought for visual
 * reasoning, but stays well within the 1M-token context budget MiMo
 * advertises. Switch to `"xhigh"` later if extraction quality needs it.
 */
export const VISION_REASONING_EFFORT = "high" as const;

/**
 * Resolve the next provider to try after a failure.
 *
 * @param currentName - `name` of the provider that just failed
 * @returns the next fallback, or `null` when no more providers are available
 */
export function getNextProvider(
  currentName: string,
): AIProviderConfig | null {
  if (currentName === AI_CONFIG.primary.name) {
    return AI_CONFIG.fallbacks[0] ?? null;
  }

  const index = AI_CONFIG.fallbacks.findIndex((p) => p.name === currentName);
  if (index === -1) {
    // Unknown provider name — fall through to the first fallback as a safe
    // default rather than returning null, so the caller always has somewhere
    // to retry.
    return AI_CONFIG.fallbacks[0] ?? null;
  }
  if (index >= AI_CONFIG.fallbacks.length - 1) {
    return null;
  }
  return AI_CONFIG.fallbacks[index + 1] ?? null;
}
