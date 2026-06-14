/**
 * JSON extraction helpers for AI responses.
 *
 * Many chat models (notably Xiaomi MiMo-V2.5 with `reasoning_effort: "high"`)
 * wrap their JSON answers in a Markdown code block even when the request
 * asked for `response_format: { type: "json_object" }`. Plain `JSON.parse`
 * throws on those — `extractJson` tolerates several common shapes so the
 * caller can always reach the underlying object.
 */

/**
 * Markdown-fenced JSON block. Captures the body inside the fences.
 *
 * Tolerates the three shapes models actually emit:
 *   - ```json\n{...}\n```
 *   - ```\n{...}\n```
 *   - whitespace around the fences
 */
const MARKDOWN_JSON_FENCE = /```(?:json)?\s*([\s\S]*?)\s*```/;

/**
 * First JSON object or array inside arbitrary prose. Used as a last-resort
 * fallback when the model embeds the answer in a sentence.
 */
const EMBEDDED_JSON = /(\{[\s\S]*?\}|\[[\s\S]*?\])/;

/**
 * Parse a JSON value from an AI response, accepting a few non-strict shapes.
 *
 * Tries in order:
 *   1. Direct `JSON.parse(content)` — the happy path.
 *   2. Strip a leading/trailing markdown code fence, then parse.
 *   3. Find the first `{...}` or `[...]` substring, then parse.
 *
 * Throws the underlying `SyntaxError` from the final `JSON.parse` attempt
 * when no shape matches — callers should catch and surface a friendly error.
 */
export function extractJson<T = unknown>(content: string): T {
  // 1. Direct parse (cheapest, covers strict jsonMode responses).
  try {
    return JSON.parse(content) as T;
  } catch {
    // fall through to markdown / embedded extraction
  }

  // 2. Markdown-wrapped JSON (```json ... ``` or ``` ... ```).
  const fenceMatch = content.match(MARKDOWN_JSON_FENCE);
  if (fenceMatch && fenceMatch[1]) {
    try {
      return JSON.parse(fenceMatch[1]) as T;
    } catch {
      // fall through to embedded extraction
    }
  }

  // 3. First JSON object/array embedded anywhere in the text.
  const embeddedMatch = content.match(EMBEDDED_JSON);
  if (embeddedMatch && embeddedMatch[1]) {
    return JSON.parse(embeddedMatch[1]) as T;
  }

  // Nothing worked — throw a descriptive error so the caller can log the
  // raw content for debugging.
  throw new SyntaxError(
    `extractJson: no parseable JSON found in AI response (${content.length} chars)`,
  );
}
