/**
 * Prompt template for the Caption Generator flow.
 *
 * The user picks a saved product + a platform/tone/audience/cta combination.
 * The model is asked to produce 3-5 multi-paragraph caption variations in
 * Bahasa Indonesia that can be used as the body text of an affiliate post
 * on the chosen platform, complete with hashtags and a brief usage tip.
 *
 * Why two layers (system + user prompt):
 * - System prompt sets the global rules (output format, language, count).
 * - User prompt carries the per-call context (product details + params).
 *
 * IMPORTANT: keep the JSON schema and field names in sync with what
 * `lib/actions/captions.ts` (Task 2) expects to parse and persist into
 * `generations.result` (JSONB).
 */

export const CAPTION_SYSTEM_PROMPT = `Anda adalah copywriter expert untuk affiliate marketing di pasar Indonesia. Tugas Anda adalah membuat 3-5 caption (teks isi postingan) untuk konten affiliate yang akan diposting di platform pilihan user.

Constraints:
- Output HANYA JSON array valid, tidak ada text lain (tidak ada markdown, tidak ada penjelasan).
- Setiap item dalam array HARUS mengikuti schema persis.
- Caption harus dalam Bahasa Indonesia yang natural dan sesuai target pasar Indonesia.
- Panjang setiap caption: 2-4 paragraf, total 200-500 karakter.
- Setiap caption WAJIB diakhiri dengan daftar hashtag (3-7 hashtag) yang relevan untuk platform dan niche produk.
- Setiap caption WAJIB menyertakan satu Call-to-Action (CTA) yang natural sesuai parameter cta user.
- Jangan gunakan emoji.
- Jangan menulis "null" atau "Unknown" di field apapun. Jika informasi tidak tersedia, gunakan string kosong "" untuk field yang opsional atau "umum" untuk field yang wajib.
- Variasikan gaya antar caption (storytelling, listicle, problem-solution, social proof, dll) supaya user punya pilihan.`;

export interface CaptionPromptProduct {
  name: string | null;
  brand: string | null;
  category: string | null;
  target_market: string | null;
  usp: string | null;
  benefits: string | null;
}

export interface CaptionPromptInput {
  product: CaptionPromptProduct;
  platform: string;
  tone: string;
  audience: string | null | undefined;
  cta: string | null | undefined;
}

/**
 * Build the user prompt for the Caption Generator.
 *
 * Pure function — no I/O, no side effects. Returns the full user-prompt
 * string to be sent alongside `CAPTION_SYSTEM_PROMPT` to the model.
 *
 * Null/empty product fields are replaced with a graceful placeholder so
 * the model never sees the literal string "null". A null `cta` is treated
 * as "tidak spesifik" so the model picks a contextually appropriate one.
 */
export function buildCaptionPrompt(input: CaptionPromptInput): string {
  const { product, platform, tone, audience, cta } = input;

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
  const safeCta = valueOrPlaceholder(cta, "tidak spesifik");

  return `Buatkan 3-5 caption affiliate untuk produk berikut.

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
- Target audience untuk caption ini: ${safeAudience}
- Call-to-Action (CTA) yang harus ada: ${safeCta}

INSTRUKSI:
- Setiap caption harus terasa natural untuk platform "${platform}" (misal: TikTok lebih punchy & santai, LinkedIn lebih profesional, Instagram bisa storytelling, Twitter/X lebih ringkas).
- Terapkan tone "${tone}" secara konsisten tapi variasikan STRUKTUR (storytelling, listicle, problem-solution, social proof, dll) supaya user punya beberapa opsi.
- Target audience spesifik: ${safeAudience}. Sesuaikan bahasa dan referensi yang relevan untuk mereka.
- Setiap caption WAJIB menyertakan CTA "${safeCta}" dengan cara yang natural di akhir caption.
- Setiap caption WAJIB diakhiri 3-7 hashtag relevan (campuran hashtag niche + branded + platform-spesifik seperti #ad #promo untuk disclosure).
- Jangan gunakan emoji.
- Jangan mengarang fakta spesifik (harga, testimoni, nama selebriti) yang tidak ada di konteks.

Output JSON array (WAJIB diikuti, HANYA JSON, tidak ada text lain):
[
  {
    "text": "string (caption 2-4 paragraf, total 200-500 karakter, Bahasa Indonesia, akhiri dengan CTA natural)",
    "hashtags": ["string", "string", "..."],
    "tips": "string (1-2 kalimat singkat: kapan/untuk apa caption ini paling cocok dipakai)"
  }
]`;
}
