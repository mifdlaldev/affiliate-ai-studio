/**
 * Prompt template for the Product Auto-Analyze flow.
 *
 * The user uploads a product image (BLIP-2 description) and/or pastes a
 * reference link. We feed both into DeepSeek V4 Flash (via `lib/ai/client.ts`)
 * and ask it to fill out a structured product brief in Indonesian.
 *
 * Why two layers (system + user prompt):
 * - System prompt sets the global rules (output format, language, fallback).
 * - User prompt carries the per-call context (image description, link).
 *
 * IMPORTANT: keep the JSON schema and field names in sync with
 * `ProductAnalysis` in `lib/actions/product.ts` and the `product_analyses`
 * row shape — the action inserts the parsed JSON directly into
 * `analysis_result`.
 */

export const PRODUCT_ANALYZE_SYSTEM_PROMPT = `Anda adalah product analyst expert untuk pasar Indonesia. Tugas Anda adalah menganalisis produk berdasarkan deskripsi dan link referensi, lalu mengisi detail produk dalam format JSON yang valid.

Constraints:
- Output HANYA JSON valid, tidak ada text lain
- Semua field WAJIB diisi (gunakan "Unknown" jika tidak bisa infer)
- Bahasa Indonesia untuk semua field
- Jika informasi tidak cukup, return semua field dengan "Unknown"
- Jangan gunakan emoji di output`;

export function buildProductAnalyzePrompt(
  imageDescription: string,
  linkContext: string
): string {
  return `Analisis produk berikut dan isi detailnya dalam JSON.

DESKRIPSI GAMBAR (dari image captioning): "${imageDescription || "Tidak ada deskripsi gambar"}"
KONTEKS LINK: "${linkContext || "Tidak ada link"}"

Output JSON schema (WAJIB diikuti):
{
  "name": "string (nama produk, Bahasa Indonesia)",
  "category": "string (kategori: kecantikan, fashion, elektronik, makanan, kesehatan, rumah tangga, atau lainnya)",
  "brand": "string (brand/merek, atau 'Unknown')",
  "price": "string (kisaran harga dalam Rupiah, contoh: 'Rp 100.000 - Rp 200.000', atau 'Unknown')",
  "target_market": "string (target pasar spesifik, contoh: 'Wanita usia 20-35 tahun yang peduli skincare')",
  "usp": "string (Unique Selling Point, 1-2 kalimat, Bahasa Indonesia)",
  "benefits": "string (3-5 manfaat utama, dipisah dengan newline, Bahasa Indonesia)"
}`;
}
