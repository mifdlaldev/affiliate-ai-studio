/**
 * Prompt template for the Photo Prompt Generator flow.
 *
 * The user picks a saved product + a style/mood/setting/composition
 * combination. The model is asked to produce 3-5 photo prompt variations
 * that can be dropped into Midjourney, Leonardo, or any text-to-image
 * model. The visual `prompt` field is in English (the working language
 * of Midjourney/Leonardo), while the human-readable metadata fields
 * (`title`, `style`, `mood`, `setting`, `composition`) are in Bahasa
 * Indonesia to match the dashboard's UI copy.
 *
 * Why two layers (system + user prompt):
 * - System prompt sets the global rules (output format, language split,
 *   count, field schema).
 * - User prompt carries the per-call context (product details + style
 *   parameters).
 *
 * IMPORTANT: keep the JSON schema and field names in sync with what
 * `lib/actions/photos.ts` (Task 2) expects to parse and persist into
 * `generations.result` (JSONB).
 */

export const PHOTO_SYSTEM_PROMPT = `Anda adalah creative director untuk konten foto produk affiliate di pasar Indonesia. Tugas Anda adalah membuat 3-5 photo prompt variations yang akan digunakan di text-to-image generator seperti Midjourney, Leonardo AI, atau DALL-E untuk membuat foto produk affiliate yang menarik.

Constraints:
- Output HANYA JSON array valid dengan 3-5 item, tidak ada text lain (tidak ada markdown, tidak ada penjelasan).
- Setiap item WAJIB mengikuti schema persis seperti di bawah.
- Field \`prompt\` (visual prompt untuk Midjourney/Leonardo) WAJIB dalam Bahasa Inggris yang detail — ini adalah working language Midjourney/Leonardo, bukan Bahasa Indonesia.
- Field \`title\`, \`style\`, \`mood\`, \`setting\`, \`composition\` WAJIB dalam Bahasa Indonesia untuk ditampilkan di dashboard user.
- Field \`aspectRatio\` WAJIB salah satu dari: "1:1", "4:5", "9:16", "16:9" (default "1:1" untuk Instagram, "4:5" untuk portrait).
- Field \`lighting\` WAJIB dalam Bahasa Indonesia (contoh: "cahaya alami soft", "studio lighting dengan rim light", "golden hour warm").
- Field \`colorPalette\` WAJIB dalam Bahasa Indonesia (contoh: "earthy tone", "monokromatik", "pastel lembut").
- Field \`cameraAngle\` WAJIB dalam Bahasa Indonesia (contoh: "eye-level", "45 derajat dari atas", "low angle dramatic", "top-down flat lay").
- Jangan gunakan emoji di manapun.
- Jangan menulis "null" atau "Unknown" di field apapun. Jika informasi tidak tersedia, gunakan string kosong "" untuk field opsional.
- Variasikan komposisi dan angle antar item supaya user punya pilihan visual yang beragam.`;

export interface PhotoPromptProduct {
  name: string | null;
  brand: string | null;
  category: string | null;
  target_market: string | null;
  usp: string | null;
  benefits: string | null;
}

export interface PhotoPromptInput {
  product: PhotoPromptProduct;
  style: string;
  mood: string;
  setting: string;
  composition: string;
}

/**
 * Build the user prompt for the Photo Prompt Generator.
 *
 * Pure function — no I/O, no side effects. Returns the full user-prompt
 * string to be sent alongside `PHOTO_SYSTEM_PROMPT` to the model.
 *
 * Null/empty product fields are replaced with a graceful placeholder so
 * the model never sees the literal string "null". Style-specific guidance
 * is appended so the resulting prompts visibly differ across styles.
 */
export function buildPhotoPrompt(input: PhotoPromptInput): string {
  const { product, style, mood, setting, composition } = input;

  const valueOrPlaceholder = (
    v: string | null | undefined,
    placeholder: string,
  ): string => {
    if (v == null) return placeholder;
    const trimmed = v.trim();
    return trimmed === "" ? placeholder : trimmed;
  };

  const name = valueOrPlaceholder(product.name, "Produk ini");
  const brand = valueOrPlaceholder(product.brand, "tidak diketahui");
  const category = valueOrPlaceholder(product.category, "umum");
  const targetMarket = valueOrPlaceholder(
    product.target_market,
    "konsumen Indonesia umum",
  );
  const usp = valueOrPlaceholder(product.usp, "kualitas dan manfaat produk");
  const benefits = valueOrPlaceholder(
    product.benefits,
    "(manfaat spesifik tidak tersedia, gunakan USP sebagai acuan)",
  );

  // Style-specific guidance to make the visual prompts differ across styles.
  const styleGuidance: Record<string, string> = {
    minimalist:
      "Gunakan background bersih, warna netral, komposisi sederhana, banyak negative space, fokus tunggal pada produk.",
    professional:
      "Gunakan pencahayaan studio yang merata, komposisi simetris, warna corporate, look premium dan trustworthy.",
    lifestyle:
      "Tampilkan produk dalam konteks penggunaan nyata sehari-hari, tangan manusia, ambient environment, natural feel.",
    creative:
      "Gunakan angle tidak biasa, pencahayaan dramatis, eksperimen warna, kontras kuat, unexpected composition.",
  };

  const styleHint =
    styleGuidance[style] ??
    "Gunakan komposisi yang menarik dan pencahayaan yang sesuai untuk produk affiliate.";

  return `Buatkan 3-5 photo prompt variations untuk produk berikut yang akan digunakan di Midjourney/Leonardo AI.

KONTEKS PRODUK:
- Nama produk: ${name}
- Brand: ${brand}
- Kategori: ${category}
- Target pasar: ${targetMarket}
- Unique Selling Point (USP): ${usp}
- Manfaat utama: ${benefits}

PARAMETER YANG DIMINTA:
- Style: ${style}
- Mood: ${mood}
- Setting: ${setting}
- Composition: ${composition}

PANDUAN STYLE (${style}):
${styleHint}

FORMAT OUTPUT (JSON array valid, 3-5 items):
[
  {
    "title": "string (judul singkat dalam Bahasa Indonesia, contoh: 'Hero shot angle 45 derajat')",
    "prompt": "string (visual prompt detail dalam Bahasa Inggris untuk Midjourney/Leonardo, panjang 50-150 kata, sertakan subjek, pencahayaan, angle, mood, style referensi seperti 'editorial product photography')",
    "style": "string (echo parameter style: ${style})",
    "mood": "string (echo parameter mood: ${mood})",
    "setting": "string (echo parameter setting: ${setting})",
    "composition": "string (echo parameter composition: ${composition})",
    "aspectRatio": "string (salah satu dari: '1:1', '4:5', '9:16', '16:9')",
    "lighting": "string (deskripsi pencahayaan dalam Bahasa Indonesia)",
    "colorPalette": "string (deskripsi palet warna dalam Bahasa Indonesia)",
    "cameraAngle": "string (deskripsi angle kamera dalam Bahasa Indonesia)"
  }
]`;
}
