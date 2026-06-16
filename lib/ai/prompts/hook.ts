/**
 * Prompt template for the Hook Generator flow.
 *
 * The user picks a saved product + a platform/tone/audience combination.
 * The model is asked to produce 3-5 short hook variations in Bahasa
 * Indonesia that can be used as opening lines for affiliate content on
 * the chosen platform.
 *
 * Why two layers (system + user prompt):
 * - System prompt sets the global rules (output format, language, count).
 * - User prompt carries the per-call context (product details + params).
 *
 * IMPORTANT: keep the JSON schema and field names in sync with what
 * `lib/actions/hooks.ts` (Task 2) expects to parse and persist into
 * `generations.result` (JSONB).
 */

export const HOOK_SYSTEM_PROMPT = `Anda adalah copywriter expert untuk affiliate marketing di pasar Indonesia. Tugas Anda adalah membuat 3-5 hook (kalimat pembuka / kalimat pertama) untuk konten affiliate yang akan diposting di platform pilihan user.

Constraints:
- Output HANYA JSON array valid, tidak ada text lain (tidak ada markdown, tidak ada penjelasan).
- Setiap item dalam array HARUS mengikuti schema persis.
- Hook harus dalam Bahasa Indonesia yang natural dan sesuai target pasar Indonesia.
- Panjang setiap hook: 1-2 kalimat (maks 200 karakter).
- Jangan gunakan emoji.
- Jangan menulis "null" atau "Unknown" di field apapun. Jika informasi tidak tersedia, gunakan string kosong "" untuk field yang opsional atau "umum" untuk field yang wajib.
- Variasikan gaya antar hook (pertanyaan, pernyataan, FOMO, storytelling, dll) supaya user punya pilihan.`;

export interface HookPromptProduct {
  name: string | null;
  brand: string | null;
  category: string | null;
  target_market: string | null;
  usp: string | null;
  benefits: string | null;
}

export interface HookPromptInput {
  product: HookPromptProduct;
  platform: string;
  tone: string;
  audience: string | null | undefined;
}

/**
 * Build the user prompt for the Hook Generator.
 *
 * Pure function — no I/O, no side effects. Returns the full user-prompt
 * string to be sent alongside `HOOK_SYSTEM_PROMPT` to the model.
 *
 * Null/empty product fields are replaced with a graceful placeholder so
 * the model never sees the literal string "null".
 */
export function buildHookPrompt(input: HookPromptInput): string {
  const { product, platform, tone, audience } = input;

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
  const safeAudience = valueOrPlaceholder(audience, "umum");

  return `Buatkan 3-5 hook affiliate untuk produk berikut.

KONTEKS PRODUK:
- Nama produk: ${name}
- Brand: ${brand}
- Kategori: ${category}
- Target pasar: ${targetMarket}
- USP (Unique Selling Point): ${usp}
- Manfaat utama: ${benefits}

PARAMETER KONTEN:
- Platform: ${platform}
- Tone/gaya: ${tone}
- Target audience untuk hook ini: ${safeAudience}

INSTRUKSI:
- Setiap hook harus terasa natural untuk platform "${platform}" (misal: TikTok lebih punchy & santai, LinkedIn lebih profesional, Instagram bisa storytelling).
- Terapkan tone "${tone}" secara konsisten tapi variasikan STRUKTUR (hook pembuka, pertanyaan, FOMO, dll) supaya user punya beberapa opsi.
- Target audience spesifik: ${safeAudience}. Sesuaikan bahasa dan referensi yang relevan untuk mereka.
- Jangan gunakan emoji.
- Jangan mengarang fakta spesifik (harga, testimoni, nama selebriti) yang tidak ada di konteks.

Output JSON array (WAJIB diikuti, HANYA JSON, tidak ada text lain):
[
  {
    "text": "string (1-2 kalimat hook, Bahasa Indonesia, maks 200 karakter)",
    "platform": "${platform}",
    "tone": "${tone}",
    "note": "string (1 kalimat singkat: kapan/untuk apa hook ini paling cocok dipakai)"
  }
]`;
}
