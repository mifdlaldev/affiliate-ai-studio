/**
 * Prompt template for the Landing Page Generator flow.
 *
 * The user picks a saved product + a tone (profesional / santai /
 * persuasif / edukatif). The model produces a single complete landing
 * page copy in Bahasa Indonesia, structured as a JSON object with 7
 * sections that match the structure of a high-converting affiliate
 * landing page:
 *
 *   - `headline`       — H1, < 80 karakter, benefit-driven
 *   - `subheadline`    — H2, 1 kalimat penjelas di bawah headline
 *   - `heroDescription`— 2-3 kalimat deskripsi hero (above the fold)
 *   - `features`       — array 3-5 fitur produk, masing-masing
 *                        { title, description }
 *   - `pricing`        — array 1-3 paket harga, masing-masing
 *                        { plan, price, features[] }
 *   - `faq`            — array 3-5 pertanyaan umum + jawaban
 *                        { question, answer }
 *   - `cta`            — 1-2 kalimat call-to-action penutup
 *
 * Why this shape (vs. Script / Photo / Live Host / Marketplace):
 * - Landing pages are the highest-leverage asset in affiliate
 *   marketing, so the model gets a much richer schema: it must
 *   produce all 7 sections in one go (otherwise the user would have
 *   to chain multiple generations).
 * - `features` and `pricing` and `faq` are arrays of structured
 *   objects (not flat strings) because the UI renders them as grids,
 *   pricing tables, and accordion previews respectively.
 * - The `tone` parameter drives the entire voice: a `persuasif` page
 *   has FOMO-loaded CTAs and urgency, while an `edukatif` page leads
 *   with value and answers.
 *
 * Why two layers (system + user prompt):
 * - System prompt sets the global rules (output format, language,
 *   section counts, no emoji, no fabricated facts).
 * - User prompt carries the per-call context (product + tone).
 *
 * IMPORTANT: keep the JSON schema and field names in sync with what
 * `lib/actions/landing.ts` expects to parse and persist into
 * `generations.result` (JSONB).
 */

export const LANDING_SYSTEM_PROMPT = `Anda adalah copywriter expert untuk landing page affiliate marketing di pasar Indonesia. Tugas Anda adalah membuat 1 landing page lengkap yang siap di-deploy untuk satu produk, dalam Bahasa Indonesia.

Constraints:
- Output HANYA JSON valid, tidak ada text lain (tidak ada markdown, tidak ada penjelasan).
- Output WAJIB dalam Bahasa Indonesia yang natural, persuasif, dan SEO-friendly untuk landing page affiliate Indonesia.
- Field \`headline\` WAJIB singkat (<= 80 karakter), benefit-driven, dan menarik. Contoh: "Jadi Copywriter AI Profesional dalam 30 Hari".
- Field \`subheadline\` WAJIB 1 kalimat penjelas di bawah headline, max 150 karakter, menyebutkan value utama.
- Field \`heroDescription\` WAJIB 2-3 kalimat deskripsi hero section (above the fold) yang menjelaskan produk, USP, dan untuk siapa.
- Field \`features\` WAJIB array berisi 3-5 fitur utama, masing-masing objek { title, description }. Title singkat (2-5 kata), description 1-2 kalimat menjelaskan manfaat.
- Field \`pricing\` WAJIB array berisi 1-3 paket harga, masing-masing objek { plan, price, features[] }. Plan = nama paket, price = string harga (misal "Rp 299.000"), features = array 3-5 benefit paket.
- Field \`faq\` WAJIB array berisi 3-5 pertanyaan umum (FAQ), masing-masing objek { question, answer }. Question = pertanyaan natural buyer, answer = jawaban 1-3 kalimat.
- Field \`cta\` WAJIB 1-2 kalimat Call-to-Action penutup yang kuat, action-oriented, dan menyebutkan urgency atau benefit (kuota terbatas, bonus, garansi, dll).
- Sesuaikan SELURUH tone copy dengan parameter \`tone\`: profesional (rapi, data-driven, B2B), santai (ramah, Gen-Z, consumer), persuasif (urgent, FOMO, action-oriented), edukatif (tenang, value-first, info produk).
- Jangan gunakan emoji di output JSON (text-only landing page).
- Jangan menulis "null" atau "Unknown" di field apapun. Jika informasi tidak tersedia, gunakan string kosong "" untuk field yang opsional.
- Jangan mengarang fakta spesifik (harga detail, testimoni, nama selebriti, jumlah user, dsb) yang tidak ada di konteks produk. Jika produk tidak punya data cukup, gunakan placeholder generik.`;

/**
 * Subset of the `products` table that the Landing Page Generator
 * actually needs. The full row would include timestamps + ownership
 * metadata we don't want to leak to the prompt.
 */
export interface LandingPromptProduct {
  name: string | null;
  brand: string | null;
  category: string | null;
  price: string | null;
  target_market: string | null;
  usp: string | null;
  benefits: string | null;
}

export interface LandingPromptInput {
  product: LandingPromptProduct;
  tone: string;
}

/**
 * Build the user prompt for the Landing Page Generator.
 *
 * Pure function — no I/O, no side effects. Returns the full user-prompt
 * string to be sent alongside `LANDING_SYSTEM_PROMPT` to the model.
 *
 * Null/empty product fields are replaced with graceful placeholders so
 * the model never sees the literal string "null". The `tone` parameter
 * drives the entire voice of the page (see LANDING_SYSTEM_PROMPT for
 * the tone definitions).
 */
export function buildLandingPrompt(input: LandingPromptInput): string {
  const { product, tone } = input;

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
  const safeTone = valueOrPlaceholder(tone, "profesional");

  // Tone-specific guidance — drives voice consistency across all 7
  // sections. Kept as a small lookup so the function stays declarative.
  const toneGuidance: Record<string, string> = {
    profesional:
      "Gaya profesional: bahasa rapi, data-driven, sebutkan angka konkret jika ada, E-E-A-T friendly. Cocok untuk B2B atau produk premium.",
    santai:
      "Gaya santai: bahasa ramah, sehari-hari, seperti ngobrol dengan teman, boleh pakai analogi sederhana. Cocok untuk consumer / Gen-Z.",
    persuasif:
      "Gaya persuasif: urgent, FOMO, action-oriented. Gunakan kata 'sekarang', 'stok terbatas', 'kesempatan terakhir', 'diskon'. Push konversi.",
    edukatif:
      "Gaya edukatif: tenang, value-first, jawab pertanyaan. Bangun trust lewat penjelasan, bukan hard-sell. Cocok untuk kursus, ebook, dan info produk.",
  };
  const toneHint = toneGuidance[safeTone] ?? "";

  return `Buatkan 1 landing page affiliate lengkap untuk produk di bawah ini dengan tone "${safeTone}".

KONTEKS PRODUK:
- Nama produk: ${name}
- Brand: ${brand}
- Kategori: ${category}
- Harga: ${price}
- Target pasar: ${targetMarket}
- Unique Selling Point (USP): ${usp}
- Manfaat utama: ${benefits}

PARAMETER LANDING PAGE:
- Tone penulisan: ${safeTone}

INSTRUKSI:
- Terapkan tone "${safeTone}" secara konsisten di semua 7 section. ${toneHint}
- Field \`headline\` WAJIB benefit-driven, singkat (<= 80 karakter), dan menarik.
- Field \`subheadline\` WAJIB 1 kalimat penjelas, max 150 karakter.
- Field \`heroDescription\` WAJIB 2-3 kalimat deskripsi hero section, jelas dan menjual.
- Field \`features\` WAJIB 3-5 fitur utama dengan title singkat + description 1-2 kalimat.
- Field \`pricing\` WAJIB 1-3 paket harga (gunakan harga produk sebagai acuan, kalau tidak ada pakai placeholder "Hubungi kami"). Setiap paket punya 3-5 features.
- Field \`faq\` WAJIB 3-5 pertanyaan natural buyer + jawaban 1-3 kalimat.
- Field \`cta\` WAJIB 1-2 kalimat penutup yang kuat dengan urgency atau benefit.
- Jangan gunakan emoji di output JSON.
- Jangan mengarang fakta spesifik (harga detail, testimoni, nama selebriti, jumlah user) yang tidak ada di konteks.

Output JSON (WAJIB diikuti, HANYA JSON, tidak ada text lain):
{
  "headline": "string (H1 benefit-driven, max 80 karakter, Bahasa Indonesia)",
  "subheadline": "string (H2 penjelas, max 150 karakter, Bahasa Indonesia)",
  "heroDescription": "string (2-3 kalimat deskripsi hero, Bahasa Indonesia)",
  "features": [
    {"title": "string (judul fitur 2-5 kata)", "description": "string (1-2 kalimat manfaat)"},
    {"title": "string (judul fitur 2-5 kata)", "description": "string (1-2 kalimat manfaat)"},
    {"title": "string (judul fitur 2-5 kata)", "description": "string (1-2 kalimat manfaat)"}
  ],
  "pricing": [
    {"plan": "string (nama paket)", "price": "string (harga, misal 'Rp 299.000')", "features": ["string benefit 1", "string benefit 2", "string benefit 3"]},
    {"plan": "string (nama paket)", "price": "string (harga)", "features": ["string benefit 1", "string benefit 2", "string benefit 3"]}
  ],
  "faq": [
    {"question": "string (pertanyaan natural buyer)", "answer": "string (jawaban 1-3 kalimat)"},
    {"question": "string (pertanyaan natural buyer)", "answer": "string (jawaban 1-3 kalimat)"},
    {"question": "string (pertanyaan natural buyer)", "answer": "string (jawaban 1-3 kalimat)"}
  ],
  "cta": "string (1-2 kalimat Call-to-Action penutup yang kuat)"
}`;
}
