import type { Asset } from "@/lib/actions/assets";

/**
 * Escape a cell value for RFC 4180 CSV.
 *
 * If the value contains a comma, double-quote, or newline it is wrapped in
 * double-quotes and any internal quotes are doubled.
 */
function escapeCsv(value: string): string {
  if (
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Produce a human-readable content column value from an asset's result.
 *
 * For arrays of text-bearing items (caption, hook, social, script) we extract
 * the `text` fields. For everything else we JSON-stringify.
 */
function contentPreview(result: unknown): string {
  if (Array.isArray(result) && result.length > 0) {
    const texts: string[] = [];
    for (const item of result) {
      if (
        item !== null &&
        typeof item === "object" &&
        "text" in item &&
        typeof (item as Record<string, unknown>).text === "string"
      ) {
        texts.push((item as Record<string, string>).text!);
      }
    }
    if (texts.length > 0) return texts.join(" | ");
  }

  // Fallback
  try {
    return JSON.stringify(result);
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Serialise an array of assets as a CSV string (RFC 4180).
 *
 * Columns:
 *  - `module`      — Asset module name.
 *  - `subtype`     — Asset subtype (empty string when null).
 *  - `created_at`  — ISO-8601 creation timestamp.
 *  - `content`     — Human-readable preview of the asset result.
 *
 * @param assets - The assets to export.
 * @returns A CSV string with a header row and one row per asset.
 */
export function exportAsCsv(assets: Asset[]): string {
  const header = "module,subtype,created_at,content";
  if (assets.length === 0) return header;

  const rows = assets.map((a) => {
    const subtype = a.subtype ?? "";
    const content = contentPreview(a.result);
    return [a.module, subtype, a.createdAt, content]
      .map(escapeCsv)
      .join(",");
  });

  return [header, ...rows].join("\n");
}
