import OpenAI from "openai";
import type { ChatCompletion } from "openai/resources/chat/completions";
import {
  AI_CONFIG,
  type AIProviderConfig,
  type ReasoningEffort,
} from "./config";
import { withRetry } from "./retry";

/** Default text model — primary provider's model. */
export const DEFAULT_TEXT_MODEL = AI_CONFIG.primary.model;

/** Default reasoning effort — primary provider's setting. */
export const REASONING_EFFORT = AI_CONFIG.primary.reasoning;

/** OpenAI client pinned to the primary provider. */
export const aiClient = new OpenAI({
  apiKey: AI_CONFIG.primary.apiKey,
  baseURL: AI_CONFIG.primary.baseURL,
});

/**
 * Content part for vision requests. Mirrors the OpenAI Chat Completions
 * vision schema — `text` parts carry the prompt, `image_url` parts carry
 * the image (as a data URL or HTTP URL).
 */
export type MessageContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface GenerateOptions {
  prompt: string;
  systemPrompt?: string;
  /** Override the provider's default model. */
  model?: string;
  /** Override the provider's default reasoning effort. */
  reasoning?: ReasoningEffort;
  /** When true, request JSON-object response. */
  jsonMode?: boolean;
  /** Use a specific provider (defaults to primary). */
  provider?: AIProviderConfig;
  /**
   * Image to send for vision-capable models (data URL or HTTP URL).
   * When set, the user message becomes a multi-part content array
   * (text + image_url) following the OpenAI vision schema. The caller
   * is responsible for picking a vision-capable model (see
   * `VISION_MODEL` in `./config`).
   */
  imageUrl?: string;
}

export interface GenerateResult {
  content: string;
  tokensUsed: number;
  durationMs: number;
  model: string;
}

interface ChatMessage {
  role: "system" | "user";
  content: string | MessageContentPart[];
}

/**
 * Body for /v1/chat/completions. Mirrors the OpenAI ChatCompletionCreateParams
 * base shape but extends it with provider-agnostic fields (e.g. `reasoning_effort`
 * with OpenCode Zen's value set, which is broader than OpenAI's).
 *
 * The OpenAI SDK's typed `chat.completions.create` is too strict for
 * OpenCode Zen's `reasoning_effort` values (`'max'`, `'non-thinking'`), so we
 * use the SDK's low-level `post` method with a fully-typed body.
 */
interface ChatCompletionRequestBody {
  model: string;
  messages: ChatMessage[];
  reasoning_effort?: ReasoningEffort;
  response_format?: { type: "json_object" };
}

function buildRequestBody(
  options: GenerateOptions,
  provider: AIProviderConfig,
): ChatCompletionRequestBody {
  const messages: ChatMessage[] = [];
  if (options.systemPrompt) {
    messages.push({ role: "system", content: options.systemPrompt });
  }

  if (options.imageUrl) {
    const parts: MessageContentPart[] = [];
    if (options.prompt) {
      parts.push({ type: "text", text: options.prompt });
    }
    parts.push({
      type: "image_url",
      image_url: { url: options.imageUrl },
    });
    messages.push({ role: "user", content: parts });
  } else {
    messages.push({ role: "user", content: options.prompt });
  }

  const body: ChatCompletionRequestBody = {
    model: options.model ?? provider.model,
    messages,
  };

  const reasoning = options.reasoning ?? provider.reasoning;
  if (reasoning) {
    body.reasoning_effort = reasoning;
  }

  if (options.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  return body;
}

/**
 * Generate text from a provider, with automatic retry.
 *
 * Honors per-call `model` / `reasoning` / `jsonMode` overrides, and falls
 * back to the provider's defaults. Use the `provider` option to explicitly
 * target a fallback (e.g. when the primary has rate-limited you).
 *
 * For image analysis, pass `imageUrl` (data URL or HTTP URL) together with
 * `model: VISION_MODEL` — the request will be sent as a vision message.
 */
export async function generateText(
  options: GenerateOptions,
): Promise<GenerateResult> {
  const provider = options.provider ?? AI_CONFIG.primary;
  const startTime = Date.now();

  const client = new OpenAI({
    apiKey: provider.apiKey,
    baseURL: provider.baseURL,
  });

  const body = buildRequestBody(options, provider);

  const result = await withRetry(async () => {
    return await client.post<ChatCompletion>("/chat/completions", { body });
  });

  const firstChoice = result.choices[0];
  return {
    content: firstChoice?.message.content ?? "",
    tokensUsed: result.usage?.total_tokens ?? 0,
    durationMs: Date.now() - startTime,
    model: body.model,
  };
}
