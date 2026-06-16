import type { Asset } from "@/lib/actions/assets";

/**
 * Serialise an asset's result as a pretty-printed JSON string.
 *
 * @param asset - The asset to export.
 * @returns The result value formatted with `JSON.stringify(result, null, 2)`.
 */
export function exportAsJson(asset: Asset): string {
  return JSON.stringify(asset.result, null, 2);
}
