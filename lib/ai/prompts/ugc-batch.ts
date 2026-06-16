/**
 * Prompt template for the UGC Batch Generator flow.
 *
 * UGC Batch = generate one UGC script per product in a single AI call.
 * The user picks 2-5 saved products + a platform/tone combination, and
 * the model emits an array of { title, text } (one per product, in the
 * same order as the input list).
 *
 * Why two layers (system + user prompt):
 * - System prompt sets the global rules (output format, language,
 *   1-script-per-product rule, output count must match input count).
 * - User prompt carries the per-call context (product list + params).
 *
 * IMPORTANT: keep the JSON schema and field names in sync with what
 * `lib/actions/ugc.ts` expects to parse and persist into
 * `generations.result` (JSONB).
 */

export const UGC_BATCH_SYSTEM_PROMPT = `Anda adalah content creator UGC (User-Generated Content) berbahasa Indonesia yang biasa membuat review/testimoni jujur untuk produk affiliate. Tugas Anda adalah membuat 1 script UGC pendek (testimoni/review jujur) untuk SETIAP produk yang user berikan, dalam SATU output JSON array — bukan beberapa output terpisah.

Karakter UGC yang harus dipertahankan:
- Script UGC terdengar seperti testimoni/review orang biasa yang baru pakai produk, BUKAN iklan profesional. Pakai bahasa sehari-hari yang natural untuk pasar Indonesia.
- Panjang "text" per script sekitar 60-150 kata (cukup untuk 1 video pendek 15-30 detik, atau 1 caption posting).
- WAJIB ada unsur pengalaman pribadi (misal: "Aku udah pakai X minggu...", "Awalnya ragu karena...", "Pas dicoba ternyata..."). Testimoni tanpa pengalaman pribadi terasa palsu.
- WAJIB ada opini jujur tentang kelebihan DAN kekurangan kecil (biar terasa real, bukan iklan sempurna).
- Sudut pandang orang pertama (aku/saya), bukan brand voice.
- Tutup dengan CTA natural (bukan hard sell) yang mengajak orang cek produknya.

Constraints:
- Output HANYA JSON array valid, tidak ada text lain (tidak ada markdown, tidak ada penjelasan, tidak ada code fence).
- JUMLAH item dalam output array WAJIB SAMA dengan jumlah produk di input (1 script per produk). Jangan lebih, jangan kurang.
- URUTAN output WAJIB mengikuti urutan produk di input (item[0] = script untuk produk[0], dst).
- Setiap item WAJIB mengikuti schema persis seperti di bawah.
- Terapkan tone yang user pilih secara konsisten di SEMUA script.
- Terapkan platform yang user pilih secara konsisten di gaya bahasa SEMUA script.
- Title (3-8 kata) dan text (60-150 kata) dalam Bahasa Indonesia.
- Jangan gunakan emoji.
- Jangan mengarang fakta spesifik (harga, testimoni spesifik, jumlah review, nama selebriti) yang tidak ada di konteks produk.
- Variasikan angle testimoni antar produk supaya tidak terasa monoton (satu problem-solution, satu storytelling, satu demo, satu review jujur, dst).
- Jangan menulis "null" atau "Unknown" di field apapun.`;

export interface UgcBatchPromptProduct {
  name: string | null;
  category: string | null;
  brand: string | null;
}

export interface UgcBatchPromptInput {
  products: UgcBatchPromptProduct[];
  platform: string;
  tone: string;
}

/**
 * Build the user prompt for the UGC Batch Generator.
 *
 * Pure function — no I/O, no side effects. Returns the full user-prompt
 * string to be sent alongside `UGC_BATCH_SYSTEM_PROMPT` to the model.
 *
 * Null/empty product fields are replaced with a graceful placeholder so
 * the model never sees the literal string "null". Each product is listed
 * with its index so the model can keep the output order aligned with
 * the input order.
 */
export function buildUgcBatchPrompt(input: UgcBatchPromptInput): string {
  const { products, platform, tone } = input;

  const valueOrPlaceholder = (
    v: string | null | undefined,
    placeholder: string,
  ): string => {
    if (v == null) return placeholder;
    const trimmed = v.trim();
    return trimmed === "" ? placeholder : trimmed;
  };

  const productLines = products
    .map((p, i) => {
      const name = valueOrPlaceholder(p.name, `Produk ${i + 1}`);
      const brand = valueOrPlaceholder(p.brand, "tidak diketahui");
      const category = valueOrPlaceholder(p.category, "umum");
      return `- Produk ${i + 1}:\n  - Nama: ${name}\n  - Brand: ${brand}\n  - Kategori: ${category}`;
    })
    .join("\n");

  return `Buatkan ${products.length} script UGC (testimoni/review jujur) — SATU script untuk SETIAP produk berikut, dalam satu output JSON array.

DAFTAR PRODUK (${products.length} item):
${productLines}

PARAMETER BATCH:
- Platform: ${platform}
- Tone: ${tone}

INSTRUKSI:
- Hasilkan tepat ${products.length} script (SATU per produk), dalam urutan yang SAMA dengan daftar produk di atas.
- Tiap script WAJIB dalam sudut pandang orang pertama (aku/saya), terasa seperti pelanggan sungguhan, BUKAN copywriter brand.
- Sesuaikan gaya bahasa dengan platform "${platform}" (tiktok lebih slangy, instagram lebih polished tapi casual, youtube narasi deskriptif, facebook storytelling).
- Terapkan tone "${tone}" secara konsisten di SEMUA script.
- WAJIB ada unsur pengalaman pribadi (berapa lama pakai, reaksi pertama, momen spesifik) di SETIAP script.
- WAJIB ada opini jujur (boleh sebut kekurangan kecil biar terasa real) di SETIAP script.
- Panjang text 60-150 kata per script.
- Akhiri tiap script dengan CTA natural yang soft.
- Variasikan angle testimoni antar produk supaya tidak monoton (campurkan problem-solution, storytelling, demo, review jujur, perbandingan, dll).
- Title 3-8 kata dalam Bahasa Indonesia, menarik untuk caption.
- Jangan gunakan emoji.
- Jangan mengarang fakta spesifik (harga, testimoni, nama selebriti) yang tidak ada di konteks.

FORMAT OUTPUT (JSON array valid dengan ${products.length} item, HANYA JSON, tidak ada text lain):
[
  {
    "title": "string (judul pendek 3-8 kata untuk caption, Bahasa Indonesia)",
    "text": "string (isi testimoni UGC 60-150 kata, Bahasa Indonesia, sudut pandang orang pertama, casual tapi informatif)"
  }
]`;
}
