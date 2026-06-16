/**
 * Prompt template for the Social Media Content Calendar Generator
 * flow.
 *
 * The user picks a saved product + a social platform (TikTok /
 * Instagram / YouTube / Twitter / Facebook) + a writing tone. The
 * model is asked to produce a 7-DAY content calendar for that single
 * platform, in Bahasa Indonesia, structured as:
 *
 *   - `platform`     — echoed back as confirmation
 *   - `days`         — array of 7 day-objects
 *       - `day`        — 1..7
 *       - `contentType`— single content type for that day
 *                        (e.g. Reels / Story / Carousel / Short /
 *                        Tweet / Thread / Post)
 *       - `topic`      — short hook-style topic
 *       - `caption`    — ready-to-paste caption copy
 *       - `hashtags`   — array of 3-7 hashtag strings (with #)
 *       - `bestTime`   — recommended posting time in WIB (e.g.
 *                        "19:00 WIB")
 *
 * Why this shape (vs. Marketplace / Live Host):
 * - A 7-day calendar needs a `days` array of repeating day-objects.
 *   No other generator produces this exact structure.
 * - Each day carries BOTH a topic (so the seller knows what to
 *   produce) AND a caption (so they can paste-and-go). This is what
 *   separates "ideas" from "full calendar".
 * - `hashtags` is always an array of strings (with leading #) so the
 *   UI can render them as chips.
 * - `bestTime` is platform-aware (TikTok 19-21, Instagram 11-13, etc).
 *
 * Why two layers (system + user prompt):
 * - System prompt sets the global rules (output format, language, 7
 *   days, no emoji, etc).
 * - User prompt carries the per-call context (product + platform +
 *   tone).
 *
 * IMPORTANT: keep the JSON schema and field names in sync with what
 * `lib/actions/social.ts` expects to parse and persist into
 * `generations.result` (JSONB).
 */

export const SOCIAL_SYSTEM_PROMPT = `Anda adalah social media strategist expert untuk konten affiliate di pasar Indonesia. Tugas Anda adalah membuat 1 kalender konten 7 HARI untuk satu platform sosial pilihan user, dalam Bahasa Indonesia.

Constraints:
- Output HANYA JSON valid, tidak ada text lain (tidak ada markdown, tidak ada penjelasan).
- Output WAJIB dalam Bahasa Indonesia yang natural, engaging, dan sesuai gaya platform yang dipilih.
- WAJIB menghasilkan tepat 7 hari konten (day: 1 sampai 7), satu hari = satu object di array \`days\`. Jangan lebih, jangan kurang.
- Setiap hari WAJIB berisi 6 field: day (integer 1-7), contentType (tipe konten spesifik platform: Reels/Story/Carousel/Short/Tweet/Thread/Post/dll), topic (topik singkat menarik), caption (caption siap paste, 2-5 kalimat, bahasa natural), hashtags (array berisi 3-7 hashtag string dengan tanda pagar # di depan, contoh: ["#skincare", "#serumvitaminC"]), bestTime (jam posting terbaik dalam zona WIB, contoh "19:00 WIB").
- Variasikan contentType antar hari (jangan monoton — mix antara Reels, Story, Carousel, dll sesuai norma platform).
- Hari ke-7 WAJIB berupa CTA / closing yang mendorong pembelian / klik link / follow, dengan urgency (stok terbatas, promo, dll).
- Sesuaikan gaya bahasa dengan tone yang dipilih user (kasual → santai, profesional → rapi, energik → heboh & exciting, inspiratif → memotivasi, edukatif → informatif & tips).
- Sesuaikan caption dengan norma platform: TikTok → punchy + hook 3 detik pertama, Instagram → aesthetic + storytelling, YouTube Shorts → edukatif + hook, Twitter/X → singkat & quotable, Facebook → komunikatif + panjang sedang.
- Jangan gunakan emoji di output caption, topic, atau field lainnya (text-only).
- Jangan menulis "null" atau "Unknown" di field apapun. Jika informasi tidak tersedia, gunakan string kosong "" untuk field opsional atau placeholder netral untuk field wajib.
- Jangan mengarang fakta spesifik (harga detail, testimoni, nama selebriti, jumlah follower) yang tidak ada di konteks.

Output JSON (WAJIB diikuti, HANYA JSON, tidak ada text lain):
{
  "platform": "string (platform yang dipilih, misal 'tiktok')",
  "days": [
    {
      "day": 1,
      "contentType": "string (tipe konten, misal 'Reels' / 'Story' / 'Carousel')",
      "topic": "string (topik singkat, max 80 karakter)",
      "caption": "string (caption siap paste, 2-5 kalimat, Bahasa Indonesia)",
      "hashtags": ["string (hashtag 1, dengan #)", "string (hashtag 2, dengan #)", "string (hashtag 3, dengan #)"],
      "bestTime": "string (jam posting terbaik zona WIB, misal '19:00 WIB')"
    }
  ]
}`;

/**
 * Minimal shape of the product row consumed by the prompt builder.
 * Mirrors what `lib/actions/social.ts` selects from the `products`
 * table (after RLS filtering). Every field is nullable because the
 * user may have saved a product with missing optional fields.
 */
export interface SocialPromptProduct {
  name: string | null;
  brand: string | null;
  category: string | null;
  price: string | null;
  target_market: string | null;
  usp: string | null;
  benefits: string | null;
}

export interface SocialPromptInput {
  product: SocialPromptProduct;
  platform: "tiktok" | "instagram" | "youtube" | "twitter" | "facebook";
  tone: "kasual" | "profesional" | "energik" | "inspiratif" | "edukatif";
}

/**
 * Build the user-side prompt that asks the model to generate a 7-day
 * social media calendar for the chosen product + platform + tone
 * combination. Pure function — no I/O, no side effects. Returns the
 * full prompt string to be sent alongside `SOCIAL_SYSTEM_PROMPT` to
 * the model.
 *
 * Null/empty product fields are replaced with graceful placeholders
 * so the model never sees the literal string "null".
 */
export function buildSocialPrompt(input: SocialPromptInput): string {
  const { product, platform, tone } = input;

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
  const price = valueOrPlaceholder(product.price, "tidak tersedia");
  const targetMarket = valueOrPlaceholder(
    product.target_market,
    "konsumen Indonesia umum",
  );
  const usp = valueOrPlaceholder(product.usp, "kualitas dan manfaat produk");
  const benefits = valueOrPlaceholder(
    product.benefits,
    "(manfaat spesifik tidak tersedia, gunakan USP sebagai acuan)",
  );

  // Platform-specific style hints — drives caption length + format.
  const platformGuidance: Record<string, string> = {
    tiktok:
      "TikTok: caption pendek-padat (<= 150 char), hook 3 detik pertama, gaya Gen-Z + FOMO-friendly, boleh pakai analogi relatable.",
    instagram:
      "Instagram: caption medium (3-5 kalimat), storytelling + aesthetic, sebutkan saving value, akhiri dengan pertanyaan untuk drive komentar.",
    youtube:
      "YouTube Shorts: caption edukatif / tutorial-hook, sebutkan benefit di kalimat pertama, gaya informatif tapi tetap menarik.",
    twitter:
      "Twitter/X: caption super pendek (<= 240 char), quotable, bisa multi-tweet / thread, witty & to-the-point.",
    facebook:
      "Facebook: caption panjang sedang (3-6 kalimat), komunikatif, gaya blog-post ringan, sebutkan benefit + social proof.",
  };
  const platformHint =
    platformGuidance[platform] ?? "ikuti norma umum media sosial Indonesia.";

  // Tone-specific guidance — drives voice consistency.
  const toneGuidance: Record<string, string> = {
    kasual:
      "Gaya kasual: bahasa santai, ramah, kayak ngobrol sama temen. Cocok untuk produk consumer sehari-hari.",
    profesional:
      "Gaya profesional: bahasa rapi, data-driven, sebutkan spesifikasi & angka konkret. Cocok untuk produk premium / B2B.",
    energik:
      "Gaya energik: heboh, exciting, ekspresif, pakai exclamasi dan urgency. Cocok untuk push engagement & konversi.",
    inspiratif:
      "Gaya inspiratif: storytelling, memotivasi, emosional. Cocok untuk produk lifestyle / self-improvement.",
    edukatif:
      "Gaya edukatif: informatif, tips & trick, how-to. Cocok untuk produk yang butuh edukasi sebelum dibeli.",
  };
  const toneHint = toneGuidance[tone] ?? "ikuti norma gaya yang diminta user.";

  return `Buatkan 1 kalender konten social media 7 HARI untuk platform "${platform}" dengan tone "${tone}" untuk produk berikut.

KONTEKS PRODUK:
- Nama produk: ${name}
- Brand: ${brand}
- Kategori: ${category}
- Harga: ${price}
- Target pasar: ${targetMarket}
- Unique Selling Point (USP): ${usp}
- Manfaat utama: ${benefits}

PARAMETER KONTEN:
- Platform: ${platform}
- Tone: ${tone}

INSTRUKSI:
- Sesuaikan caption dengan norma platform "${platform}": ${platformHint}
- Terapkan tone "${tone}" secara konsisten: ${toneHint}
- Variasikan contentType tiap hari (jangan monoton) — mix Reels/Story/Carousel/Short/Tweet/Thread/Post dll sesuai norma ${platform}.
- Untuk setiap hari, tentukan bestTime yang realistis untuk audiens Indonesia di zona WIB (misal TikTok 19-21 WIB, Instagram 11-13 atau 19-21 WIB, YouTube 17-20 WIB, Twitter 12-14 atau 20-22 WIB, Facebook 13-16 atau 19-21 WIB).
- Untuk setiap hari, berikan 3-7 hashtag relevan (lowercase, dengan tanda #, mix antara hashtag niche + broader untuk discoverability).
- Hari ke-7 WAJIB berupa CTA / closing: dorong pembelian, klik link, atau follow, dengan urgency natural (stok terbatas / promo /限时).
- Jangan gunakan emoji.
- Jangan mengarang fakta spesifik (harga detail, testimoni, nama selebriti) yang tidak ada di konteks.

Output JSON (WAJIB diikuti, HANYA JSON, tidak ada text lain):
{
  "platform": "${platform}",
  "days": [
    { "day": 1, "contentType": "string", "topic": "string", "caption": "string", "hashtags": ["#tag1", "#tag2", "#tag3"], "bestTime": "HH:MM WIB" },
    { "day": 2, "contentType": "string", "topic": "string", "caption": "string", "hashtags": ["#tag1", "#tag2", "#tag3"], "bestTime": "HH:MM WIB" },
    { "day": 3, "contentType": "string", "topic": "string", "caption": "string", "hashtags": ["#tag1", "#tag2", "#tag3"], "bestTime": "HH:MM WIB" },
    { "day": 4, "contentType": "string", "topic": "string", "caption": "string", "hashtags": ["#tag1", "#tag2", "#tag3"], "bestTime": "HH:MM WIB" },
    { "day": 5, "contentType": "string", "topic": "string", "caption": "string", "hashtags": ["#tag1", "#tag2", "#tag3"], "bestTime": "HH:MM WIB" },
    { "day": 6, "contentType": "string", "topic": "string", "caption": "string", "hashtags": ["#tag1", "#tag2", "#tag3"], "bestTime": "HH:MM WIB" },
    { "day": 7, "contentType": "string", "topic": "string", "caption": "string", "hashtags": ["#tag1", "#tag2", "#tag3"], "bestTime": "HH:MM WIB" }
  ]
}`;
}
