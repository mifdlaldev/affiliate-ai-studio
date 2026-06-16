/**
 * Prompt template for the Marketplace Product Description Generator
 * flow.
 *
 * The user picks a saved product + a marketplace platform (Tokopedia,
 * Shopee, Lazada, TikTok Shop, Bukalapak) + a writing style + target
 * length + whether to include technical specs + an optional target
 * audience. The model produces a single marketplace-ready product
 * listing copy in Bahasa Indonesia, structured as:
 *
 *   - `title`           — short, SEO-friendly listing headline (<= 70 chars)
 *   - `shortDescription`— 1-2 sentence hook used in search results
 *   - `description`     — full product description body
 *   - `bulletPoints`    — array of 4-6 selling-point bullets
 *   - `tags`            — array of SEO keywords / hashtags
 *   - `cta`             — call-to-action closing line
 *
 * Why this shape (vs. Script / Photo / Live Host):
 * - Marketplace listings live and die on search discoverability, so
 *   we need a `title` (headline), `tags` (SEO keywords), and a
 *   `shortDescription` (snippet) — none of the other generators
 *   produce these.
 * - `bulletPoints` give the seller a quick-paste feature list
 *   formatted the way marketplace UIs render it.
 * - `cta` is the closing sales line ("klik keranjang kuning", etc)
 *   tailored to the marketplace norms in Indonesia.
 *
 * Why two layers (system + user prompt):
 * - System prompt sets the global rules (output format, language, count).
 * - User prompt carries the per-call context (product + parameters).
 *
 * IMPORTANT: keep the JSON schema and field names in sync with what
 * `lib/actions/marketplace.ts` expects to parse and persist into
 * `generations.result` (JSONB).
 */

export const MARKETPLACE_SYSTEM_PROMPT = `Anda adalah copywriter expert untuk listing produk marketplace di Indonesia (Tokopedia, Shopee, Lazada, TikTok Shop, Bukalapak). Tugas Anda adalah membuat 1 deskripsi produk marketplace lengkap yang siap di-paste seller ke listing mereka, dalam Bahasa Indonesia.

Constraints:
- Output HANYA JSON valid, tidak ada text lain (tidak ada markdown, tidak ada penjelasan).
- Output WAJIB dalam Bahasa Indonesia yang natural, persuasif, dan SEO-friendly untuk marketplace Indonesia.
- Field \`title\` WAJIB singkat (<= 70 karakter), menarik, dan menyertakan nama brand + benefit utama. Contoh: "GlowLab Serum Vitamin C 20% - Mencerahkan Kulit 14 Hari".
- Field \`shortDescription\` WAJIB 1-2 kalimat hook yang muncul di search result, menarik dan to-the-point.
- Field \`description\` WAJIB paragraf lengkap yang menjelaskan produk, USP, target pasar, dan cara pakai. Panjang mengikuti parameter \`length\` (pendek ~50-100 kata, sedang ~150-250 kata, panjang ~300-500 kata).
- Field \`bulletPoints\` WAJIB array berisi 4-6 poin utama (fitur, manfaat, keunggulan) — format poin singkat dan scannable. Jika \`includeSpecs=true\`, sertakan 1-2 poin spesifikasi teknis (ukuran, bahan, dll). Jika \`includeSpecs=false\`, fokus pada benefit dan use case.
- Field \`tags\` WAJIB array berisi 5-10 keyword SEO / hashtag relevan (lowercase, tanpa tanda pagar), misal: "serum vitamin c", "skincare pencerah", "anti aging", "glowlab".
- Field \`cta\` WAJIB 1-2 kalimat Call-to-Action penutup yang natural, arahkan ke keranjang / checkout, dan sebutkan benefit atau urgency (stok terbatas, diskon, free ongkir, garansi).
- Sesuaikan tone / gaya penulisan dengan parameter \`style\`: profesional (rapi, data-driven, formal), kasual (santai, ramah, sehari-hari), persuasif (urgent, FOMO, action-oriented), berbagi-cerita (storytelling, personal experience, emosional).
- Sesuaikan dengan norma platform tertentu: Tokopedia (informatif + terstruktur), Shopee (catchy + emoji-friendly text), Lazada (premium + benefit-focused), TikTok Shop (Gen-Z, casual, hook-driven), Bukalapak (sederhana, tradisional).
- Jangan gunakan emoji di output JSON (text-only listing).
- Jangan menulis "null" atau "Unknown" di field apapun. Jika informasi tidak tersedia, gunakan string kosong "" untuk field yang opsional.
- Jangan mengarang fakta spesifik (harga, testimoni, nama selebriti, jumlah review) yang tidak ada di konteks.`;

export interface MarketplacePromptProduct {
  name: string | null;
  brand: string | null;
  category: string | null;
  price: string | null;
  target_market: string | null;
  usp: string | null;
  benefits: string | null;
}

export interface MarketplacePromptInput {
  product: MarketplacePromptProduct;
  platform: string;
  style: string;
  length: string;
  includeSpecs: boolean;
  targetAudience: string | null | undefined;
}

/**
 * Build the user prompt for the Marketplace Product Description
 * Generator.
 *
 * Pure function — no I/O, no side effects. Returns the full user-prompt
 * string to be sent alongside `MARKETPLACE_SYSTEM_PROMPT` to the model.
 *
 * Null/empty product fields are replaced with graceful placeholders so
 * the model never sees the literal string "null". The `length`
 * parameter drives the target word count; `includeSpecs` toggles
 * whether to ask for technical-spec bullets. `targetAudience` is
 * optional — when null/empty we fall back to the product's own
 * `target_market` field.
 */
export function buildMarketplacePrompt(input: MarketplacePromptInput): string {
  const {
    product,
    platform,
    style,
    length,
    includeSpecs,
    targetAudience,
  } = input;

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
  const safeAudience = valueOrPlaceholder(targetAudience, targetMarket);
  const safeLength = valueOrPlaceholder(length, "sedang");
  const safeStyle = valueOrPlaceholder(style, "profesional");
  const safePlatform = valueOrPlaceholder(platform, "shopee");

  // Word-count guidance keyed to the length enum.
  const lengthGuidance: Record<string, string> = {
    pendek: "50-100 kata",
    sedang: "150-250 kata",
    panjang: "300-500 kata",
  };
  const targetWords = lengthGuidance[safeLength] ?? "150-250 kata";

  // Platform-specific style hints — guides the model to match each
  // marketplace's listing culture.
  const platformGuidance: Record<string, string> = {
    tokopedia:
      "Tokopedia buyer lebih suka listing terstruktur: paragraf pembuka informatif, lalu bullet points, lalu paragraf penutup. Hindari bahasa hiperbolis.",
    shopee:
      "Shopee buyer suka catchphrase catchy dan benefit-oriented. Listing bisa lebih pendek dan to-the-point. Hindari jargon.",
    lazada:
      "Lazada buyer lebih premium. Tonjolkan kualitas, bahan, dan benefit eksklusif. Listing rapi dan elegan.",
    "tiktok-shop":
      "TikTok Shop buyer Gen-Z. Gaya santai, hook-driven, FOMO-friendly, boleh pakai analogi relatable. Singkat dan punchy.",
    bukalapak:
      "Bukalapak buyer tradisional Indonesia. Gaya sederhana, langsung ke benefit utama, hindari bahasa Inggris.",
  };
  const platformHint = platformGuidance[safePlatform] ?? "";

  // Style-specific guidance — drives tone consistency.
  const styleGuidance: Record<string, string> = {
    profesional:
      "Gaya profesional: bahasa rapi, data-driven, sebutkan spesifikasi dan angka konkret jika ada. Cocok untuk produk B2B atau premium.",
    kasual:
      "Gaya kasual: bahasa santai, ramah, seperti ngobrol dengan teman. Cocok untuk produk consumer sehari-hari.",
    persuasif:
      "Gaya persuasif: urgent, FOMO, action-oriented, gunakan kata-kata seperti 'sekarang', 'stok terbatas', 'kesempatan terakhir', 'diskon'. Cocok untuk push conversion.",
    "berbagi-cerita":
      "Gaya berbagi cerita: storytelling, personal experience, emosional. Buka dengan narasi use case atau testimoni fiktif (jangan sebut nama orang nyata).",
  };
  const styleHint = styleGuidance[safeStyle] ?? "";

  return `Buatkan 1 deskripsi listing produk marketplace untuk platform "${safePlatform}" dengan gaya "${safeStyle}" dan panjang "${safeLength}".

KONTEKS PRODUK:
- Nama produk: ${name}
- Brand: ${brand}
- Kategori: ${category}
- Harga: ${price}
- Target pasar: ${targetMarket}
- Unique Selling Point (USP): ${usp}
- Manfaat utama: ${benefits}

PARAMETER MARKETPLACE:
- Platform: ${safePlatform}
- Gaya penulisan: ${safeStyle}
- Panjang deskripsi: ${safeLength} (target ${targetWords})
- Sertakan spesifikasi teknis: ${includeSpecs ? "ya" : "tidak"}
- Target audience spesifik: ${safeAudience}

INSTRUKSI:
- Sesuaikan gaya dengan platform "${safePlatform}": ${platformHint || "ikuti norma umum marketplace Indonesia"}.
- Terapkan gaya "${safeStyle}" secara konsisten. ${styleHint}
- Target audience: ${safeAudience}. Sesuaikan bahasa, referensi, contoh, dan analogi agar relevan untuk mereka.
- Field \`title\` WAJIB singkat (<= 70 karakter), menarik, SEO-friendly, dan menyertakan brand + benefit utama.
- Field \`description\` WAJIB panjang sekitar ${targetWords}, terstruktur, natural, dan menjual.
- Field \`bulletPoints\` WAJIB 4-6 poin scannable. ${
    includeSpecs
      ? "Sertakan 1-2 poin spesifikasi teknis (ukuran, bahan, komposisi) karena user meminta includeSpecs=true."
      : "Fokus pada benefit dan use case, BUKAN spesifikasi teknis, karena user meminta includeSpecs=false."
  }
- Field \`tags\` WAJIB 5-10 keyword SEO / hashtag (lowercase, tanpa pagar) untuk discoverability.
- Field \`cta\` WAJIB 1-2 kalimat penutup yang action-oriented, arahkan ke keranjang / checkout.
- Jangan gunakan emoji di output (text-only listing).
- Jangan mengarang fakta spesifik (harga detail, testimoni, nama selebriti) yang tidak ada di konteks.

Output JSON (WAJIB diikuti, HANYA JSON, tidak ada text lain):
{
  "title": "string (judul listing singkat, max 70 karakter, Bahasa Indonesia, SEO-friendly)",
  "shortDescription": "string (1-2 kalimat hook untuk search result snippet)",
  "description": "string (paragraf lengkap produk, ${targetWords}, Bahasa Indonesia)",
  "bulletPoints": ["string (poin fitur/manfaat 1)", "string (poin fitur/manfaat 2)", "string (poin fitur/manfaat 3)", "string (poin fitur/manfaat 4)", "string (poin fitur/manfaat 5)"],
  "tags": ["string (keyword SEO 1)", "string (keyword SEO 2)", "string (keyword SEO 3)", "string (keyword SEO 4)", "string (keyword SEO 5)"],
  "cta": "string (1-2 kalimat Call-to-Action penutup)"
}`;
}
