/**
 * Prompt template for the Product Auto-Analyze flow.
 *
 * The user uploads a product image and/or pastes a reference link. The
 * image is sent directly to the model (vision-capable: mimo-v2.5-free
 * on OpenCode Zen), and the link — if provided — is interpolated into
 * the prompt as plain text for the model to reason about.
 *
 * Why two layers (system + user prompt):
 * - System prompt sets the global rules (output format, language, fallback).
 * - User prompt carries the per-call context (image, link).
 *
 * IMPORTANT: keep the JSON schema and field names in sync with
 * `ProductAnalysis` in `lib/actions/product.ts` and the `product_analyses`
 * row shape — the action inserts the parsed JSON directly into
 * `analysis_result`.
 */

export const PRODUCT_ANALYZE_SYSTEM_PROMPT = `Anda adalah product analyst expert untuk pasar Indonesia. Tugas Anda adalah menganalisis produk berdasarkan gambar dan/atau link yang diberikan, lalu mengisi detail produk dalam format JSON yang valid.

Constraints:
- Output HANYA JSON valid, tidak ada text lain
- Semua field WAJIB diisi. Untuk field yang TIDAK bisa di-infer dari konteks, buat tebakan terbaik berdasarkan kategori produk umum di pasar Indonesia (misal: "kecantikan" → "Wanita 20-35 tahun"). JANGAN menulis "Unknown" — jika tidak ada konteks sama sekali, gunakan placeholder kategori umum yang masuk akal.
- Bahasa Indonesia untuk semua field
- Jika nama produk tidak tersedia, buat nama generik berdasarkan kategori (misal: "Produk Skincare" untuk kategori kecantikan)
- Jangan gunakan emoji di output`;

export interface ProductAnalyzePromptInput {
  /** Data URL or HTTP URL of the uploaded product image. Empty string if none. */
  imageUrl: string;
  /** Reference product link (Shopee / TikTok Shop / Tokopedia). Empty string if none. */
  linkContext: string;
}

export function buildProductAnalyzePrompt(
  input: ProductAnalyzePromptInput,
): string {
  const { imageUrl, linkContext } = input;
  const hasImage = !!imageUrl;
  const hasLink = !!linkContext;

  let contextSection: string;
  if (hasImage && hasLink) {
    contextSection = `GAMBAR PRODUK: lihat gambar yang terlampir (data URL di bawah ini).
KONTEKS LINK PRODUK: ${linkContext}

Gunakan KEDUA sumber di atas — analisis visual dari gambar DAN informasi dari link — untuk mengisi field secara akurat.`;
  } else if (hasImage) {
    contextSection = `GAMBAR PRODUK: lihat gambar yang terlampir (data URL di bawah ini).

Gunakan analisis visual dari gambar untuk mengisi field. Untuk field yang tidak bisa di-infer (seperti harga dari marketplace), buat estimasi berdasarkan kategori produk umum di Indonesia.`;
  } else if (hasLink) {
    contextSection = `KONTEKS LINK PRODUK: ${linkContext}

Gunakan informasi dari link (URL, slug, deskripsi jika tersedia) untuk mengisi field. Untuk field yang tidak bisa di-infer, buat estimasi berdasarkan kategori produk umum di Indonesia.`;
  } else {
    contextSection = `TIDAK ADA KONTEKS YANG TERSEDIA (tidak ada gambar, tidak ada link).

Untuk kasus ini: gunakan pengetahuan umum Anda tentang produk-produk umum di pasar Indonesia. Pilih satu kategori (kecantikan, fashion, elektronik, makanan, kesehatan, atau rumah tangga) dan buat field yang masuk akal untuk produk dalam kategori tersebut. JANGAN menulis "Unknown" di field manapun.`;
  }

  return `Analisis produk berikut dan isi detailnya dalam JSON.

${contextSection}

Output JSON schema (WAJIB diikuti):
{
  "name": "string (nama produk, Bahasa Indonesia)",
  "category": "string (kategori: kecantikan, fashion, elektronik, makanan, kesehatan, rumah tangga, atau lainnya)",
  "brand": "string (brand/merek, atau estimasi umum jika tidak ada)",
  "price": "string (kisaran harga dalam Rupiah, contoh: 'Rp 100.000 - Rp 200.000', atau estimasi untuk kategori tersebut)",
  "target_market": "string (target pasar spesifik, contoh: 'Wanita usia 20-35 tahun yang peduli skincare')",
  "usp": "string (Unique Selling Point, 1-2 kalimat, Bahasa Indonesia)",
  "benefits": "string (3-5 manfaat utama, dipisah dengan newline, Bahasa Indonesia)"
}`;
}
