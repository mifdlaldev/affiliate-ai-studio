/**
 * Trigger a browser download for `content`, saved as `filename` with
 * the given MIME type. The anchor used to dispatch the click is
 * synthetic (never attached to the DOM); the object URL is revoked
 * immediately so the browser can reclaim the underlying memory.
 */
export function downloadFile(
  content: string,
  filename: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
