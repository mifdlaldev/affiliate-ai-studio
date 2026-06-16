import type { Asset } from "@/lib/actions/assets";
import type { Json } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Format a single item from a caption result array
// ---------------------------------------------------------------------------
function formatCaptionItem(item: {
  text?: string;
  hashtags?: string[];
  tips?: string;
}): string {
  const parts: string[] = [];

  if (item.text) parts.push(item.text);
  if (item.hashtags && item.hashtags.length > 0) {
    parts.push(`Hashtags: ${item.hashtags.join(" ")}`);
  }
  if (item.tips) parts.push(`Tips: ${item.tips}`);

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Format a single item from a hook result array
// ---------------------------------------------------------------------------
function formatHookItem(item: {
  text?: string;
  platform?: string;
  tone?: string;
  note?: string;
}): string {
  const parts: string[] = [];

  if (item.text) parts.push(item.text);
  if (item.platform) parts.push(`Platform: ${item.platform}`);
  if (item.tone) parts.push(`Tone: ${item.tone}`);
  if (item.note) parts.push(`Note: ${item.note}`);

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Format a single item from a script result array
// ---------------------------------------------------------------------------
function formatScriptItem(item: {
  title?: string;
  scenes?: Array<{ time?: string; visuals?: string; audio?: string; text?: string }>;
  cta?: string;
}): string {
  const parts: string[] = [];

  if (item.title) parts.push(`Script: ${item.title}`);
  parts.push("");

  if (item.scenes && item.scenes.length > 0) {
    item.scenes.forEach((scene, i) => {
      parts.push(`[Scene ${i + 1}]${scene.time ? ` (${scene.time})` : ""}`);
      if (scene.visuals) parts.push(`  Visual: ${scene.visuals}`);
      if (scene.audio) parts.push(`  Audio: ${scene.audio}`);
      if (scene.text) parts.push(`  Teks: ${scene.text}`);
      parts.push("");
    });
  }

  if (item.cta) parts.push(`CTA: ${item.cta}`);

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Detect if a value is an array of items with a "text" field (caption/hook
// style) or "title" + "scenes" (script style).
// ---------------------------------------------------------------------------

/** Check whether `arr` looks like an array of caption/hook items. */
function isTextItemArray(arr: Json): boolean {
  return (
    Array.isArray(arr) &&
    arr.length > 0 &&
    typeof arr[0] === "object" &&
    arr[0] !== null &&
    typeof (arr[0] as Record<string, unknown>).text === "string"
  );
}

/** Check whether a single item looks like a script (has "scenes" array). */
function isScriptItem(obj: Record<string, unknown>): boolean {
  return (
    Array.isArray(obj.scenes) &&
    obj.scenes.length > 0 &&
    typeof obj.scenes[0] === "object" &&
    obj.scenes[0] !== null
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Format an asset's result as human-readable plain text.
 *
 * The output adapts to the asset module:
 *  - **caption**: Item text, hashtags, tips — separated by blank lines.
 *  - **hook**:    Item text, platform, tone, optional note.
 *  - **script**:  Title, numbered scenes (time, visuals, audio, text), CTA.
 *  - **fallback**: JSON.stringify(result, null, 2).
 */
export function exportAsTxt(asset: Asset): string {
  const { module: mod, result } = asset;

  // Caption & hook both produce arrays of { text, ... } objects.
  if (mod === "caption" || mod === "hook" || mod === "social") {
    if (isTextItemArray(result)) {
      const items = result as unknown as Array<Record<string, unknown>>;
      return items
        .map((item) => {
          if (mod === "caption") return formatCaptionItem(item as Parameters<typeof formatCaptionItem>[0]);
          return formatHookItem(item as Parameters<typeof formatHookItem>[0]);
        })
        .join("\n\n");
    }
  }

  if (mod === "script") {
    if (isTextItemArray(result)) {
      const items = result as unknown as Array<Record<string, unknown>>;
      return items
        .map((item) => {
          if (isScriptItem(item)) return formatScriptItem(item as Parameters<typeof formatScriptItem>[0]);
          // Fallback for script-like items that don't look right
          return JSON.stringify(item, null, 2);
        })
        .join("\n\n");
    }
  }

  // Fallback: pretty-print whatever we got.
  return JSON.stringify(result, null, 2);
}
