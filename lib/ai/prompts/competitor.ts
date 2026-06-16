/**
 * Prompt template for the Competitor Analyzer flow.
 *
 * The user picks one of their own saved products (full record) and pastes
 * the URL of a competitor product page on Shopee / Tokopedia / TikTok Shop
 * / Lazada. The model is asked to analyze the competitor's listing
 * (positioning, price, rating, strengths, weaknesses) AND identify content
 * gaps the user can exploit in their own affiliate content strategy.
 *
 * Why two layers (system + user prompt):
 * - System prompt sets the global rules (output format, language, the
 *   fact that we're comparing the competitor against the USER's product,
 *   fallback rules when the URL is not fetchable).
 * - User prompt carries the per-call context (user's product + competitor
 *   URL + platform marketplace).
 *
 * IMPORTANT: keep the JSON schema and field names in sync with what
 * `lib/actions/competitor.ts` (Task 2) expects to parse and persist into
 * `competitor_analyses.result` (JSONB).
 */

export const COMPETITOR_SYSTEM_PROMPT = `Anda adalah competitive intelligence analyst untuk pasar affiliate Indonesia. Tugas Anda adalah menganalisis produk kompetitor (berdasarkan URL listing marketplace yang diberikan) dibandingkan dengan produk milik user, lalu menghasilkan laporan competitive analysis dalam format JSON yang valid.

Tujuan analisis:
- Membantu affiliate marketer Indonesia memahami posisi kompetitif produknya
- Mengidentifikasi strength + weakness kompetitor dari sudut pandang content creator
- Menemukan content gap yang bisa dieksploitasi user untuk diferenciasi konten affiliate-nya
- Menghasilkan rekomendasi konkret dan actionable

Constraints:
- Output HANYA JSON valid sesuai schema di bawah, tidak ada text lain (tidak ada markdown, tidak ada penjelasan, tidak ada code fence).
- Semua field WAJIB diisi. Untuk field array (strengths, weaknesses, contentGaps, recommendations), minimal 2 item, maksimal 5 item per array.
- Semua teks (string field + array of string) WAJIB dalam Bahasa Indonesia, natural untuk pasar Indonesia, BUKAN terjemahan literal dari bahasa Inggris.
- "competitorName" adalah nama produk kompetitor yang tertera di listing (atau estimasi terbaik dari URL jika tidak bisa di-fetch).
- "priceRange" adalah estimasi kisaran harga kompetitor dalam format Rupiah (contoh: "Rp 150.000 - Rp 200.000"). Jika tidak bisa di-infer, gunakan "Tidak tersedia".
- "rating" adalah rating kompetitor dalam format desimal string (contoh: "4.8" atau "4.5/5"). Jika tidak tersedia, gunakan "Tidak tersedia".
- "strengths" berisi 2-5 poin kekuatan kompetitor (fitur, harga, social proof, SEO listing, dll) yang relevan untuk affiliate comparison.
- "weaknesses" berisi 2-5 poin kelemahan kompetitor (harga mahal, rating rendah, sedikit review, deskripsi minim, foto produk kurang, dll).
- "contentGaps" berisi 2-5 peluang konten yang BELUM diliput kompetitor tapi relevan untuk niche user (tutorial, perbandingan, demo, dll). Ini insight PALING BERHARGA untuk affiliate strategy.
- "recommendations" berisi 2-5 rekomendasi konkret untuk user (angle konten, target audience, platform prioritas, format konten, dll).
- "overallAssessment" adalah 2-4 kalimat ringkasan posisi kompetitif, dalam Bahasa Indonesia, conversational, bukan bullet point.
- Jangan gunakan emoji di output.
- Jangan mengarang fakta spesifik (harga pasti, testimoni spesifik, jumlah review pasti) yang tidak ada di konteks. Gunakan estimasi yang jelas ditandai dengan kata "estimasi" jika diperlukan.
- Field "strengths", "weaknesses", "contentGaps", "recommendations" WAJIB berupa array of string, satu kalimat per item (tidak perlu numbering atau bullet di dalam string).
- Jika URL tidak bisa di-fetch atau dianalisis, tetap hasilkan JSON dengan field yang diisi best-effort dan tandai di "overallAssessment" bahwa analisis berdasarkan estimasi umum.`;

export interface CompetitorPromptProduct {
  id: string;
  name: string;
  category: string | null;
  brand: string | null;
  price: string | null;
  target_market: string | null;
  usp: string | null;
}

export type CompetitorPlatform = "shopee" | "tokopedia" | "tiktok-shop" | "lazada";

export interface CompetitorPromptInput {
  product: CompetitorPromptProduct;
  competitorUrl: string;
  platform: CompetitorPlatform;
}

const PLATFORM_DISPLAY_ID: Record<CompetitorPlatform, string> = {
  shopee: "Shopee",
  tokopedia: "Tokopedia",
  "tiktok-shop": "TikTok Shop",
  lazada: "Lazada",
};

/**
 * Build the user prompt for the Competitor Analyzer.
 *
 * Pure function — no I/O, no side effects. Returns the full user-prompt
 * string to be sent alongside `COMPETITOR_SYSTEM_PROMPT` to the model.
 *
 * Null/empty product fields are replaced with a graceful placeholder so
 * the model never sees the literal string "null" in its context. The
 * product record is presented as a comparison anchor so the model can
 * frame the competitor's strengths/weaknesses as a *differential*
 * (vs the user's product), not just an absolute description.
 */
export function buildCompetitorPrompt(input: CompetitorPromptInput): string {
  const { product, competitorUrl, platform } = input;

  const valueOrPlaceholder = (
    v: string | null | undefined,
    placeholder: string,
  ): string => {
    if (v == null) return placeholder;
    const trimmed = v.trim();
    return trimmed === "" ? placeholder : trimmed;
  };

  const productName = valueOrPlaceholder(product.name, "(nama produk tidak tersedia)");
  const productCategory = valueOrPlaceholder(product.category, "(kategori tidak tersedia)");
  const productBrand = valueOrPlaceholder(product.brand, "(brand tidak tersedia)");
  const productPrice = valueOrPlaceholder(product.price, "(kisaran harga tidak tersedia)");
  const productTargetMarket = valueOrPlaceholder(product.target_market, "(target market tidak tersedia)");
  const productUsp = valueOrPlaceholder(product.usp, "(USP tidak tersedia)");

  const platformDisplay = PLATFORM_DISPLAY_ID[platform];

  return `Lakukan competitive analysis terhadap listing produk kompetitor di marketplace ${platformDisplay} (${platform}) dan bandingkan dengan produk milik user.

PRODUK USER (acuan perbandingan):
- Nama: ${productName}
- Kategori: ${productCategory}
- Brand: ${productBrand}
- Kisaran harga: ${productPrice}
- Target market: ${productTargetMarket}
- USP (Unique Selling Point): ${productUsp}

URL KOMPETITOR:
${competitorUrl}

INSTRUKSI:
- Analisis listing kompetitor di URL tersebut (nama produk, harga, rating, deskripsi, foto jika tersedia, positioning).
- Bandingkan dengan produk user di atas — strengths/weaknesses kompetitor adalah *differential* terhadap produk user, bukan deskripsi absolut.
- Fokus pada insight yang bisa dieksploitasi user untuk content affiliate: angle, gap, format, platform.
- Semua output dalam Bahasa Indonesia, natural untuk pasar Indonesia.

FORMAT OUTPUT (JSON object valid, HANYA JSON, tidak ada text lain):
{
  "competitorName": "string (nama produk kompetitor dari listing, Bahasa Indonesia)",
  "priceRange": "string (kisaran harga kompetitor dalam Rupiah, contoh: 'Rp 150.000 - Rp 200.000', atau 'Tidak tersedia')",
  "rating": "string (rating kompetitor, contoh: '4.8' atau '4.5/5', atau 'Tidak tersedia')",
  "strengths": "array of string (2-5 poin kekuatan kompetitor yang relevan untuk perbandingan dengan produk user)",
  "weaknesses": "array of string (2-5 poin kelemahan kompetitor yang bisa dieksploitasi user)",
  "contentGaps": "array of string (2-5 peluang konten affiliate yang BELUM diliput kompetitor tapi relevan untuk niche user)",
  "recommendations": "array of string (2-5 rekomendasi konkret untuk strategi content affiliate user)",
  "overallAssessment": "string (2-4 kalimat ringkasan posisi kompetitif dalam Bahasa Indonesia conversational)"
}`;
}
