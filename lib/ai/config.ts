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
