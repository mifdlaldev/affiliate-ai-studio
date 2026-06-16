/**
 * Prompt template for the Live Host Script Generator flow.
 *
 * The user picks a saved product + a platform/tone/audience/duration
 * combination. The model is asked to produce a single live-streaming
 * host script in Bahasa Indonesia, structured as TIME-STAMPED SEGMENTS
 * (not scenes) so the host can read along while broadcasting on TikTok
 * Live / Instagram Live / YouTube Live.
 *
 * Why segments and not scenes?
 * - Live streams are unscripted-feeling but still need an outline. A
 *   segment is a chunk of broadcast time (e.g. "Opening", "Demo",
 *   "Q&A") with timing labels in minutes.
 * - Each segment carries a `hostScript` (what the host actually says),
 *   `keyPoints` (bullet recap), and `engagementTip` (how to keep
 *   viewers hooked — polls, questions, giveaways, etc).
 *
 * Why two layers (system + user prompt):
 * - System prompt sets the global rules (output format, language, count).
 * - User prompt carries the per-call context (product details + params).
 *
 * IMPORTANT: keep the JSON schema and field names in sync with what
 * `lib/actions/live-host.ts` expects to parse and persist into
 * `generations.result` (JSONB).
 *
 * Duration is in MINUTES (15, 30, 60) — not seconds like the Script
 * Generator. Live streams are long-form content.
 */

export const LIVE_HOST_SYSTEM_PROMPT = `Anda adalah host live streaming expert untuk konten affiliate di pasar Indonesia. Tugas Anda adalah membuat 1 script host live streaming berdurasi 15, 30, atau 60 MENIT (bukan detik) untuk produk pilihan user.

Constraints:
- Output HANYA JSON valid, tidak ada text lain (tidak ada markdown, tidak ada penjelasan).
- Script harus dalam Bahasa Indonesia yang natural dan sesuai gaya host live Indonesia (energik, interaktif, sering menyapa penonton).
- Script HARUS terstruktur sebagai SEGMENTS (potongan segmen live), bukan scenes. Setiap segment punya label waktu dalam menit (misal "0-2 menit", "2-7 menit").
- Total durasi seluruh segments HARUS sama dengan target durasi live (15, 30, atau 60 menit).
- Setiap segment WAJIB memiliki 5 field: time (label waktu), segmentName (nama fase live: Opening/Hook/Demo/Story/Objection/Q&A/CTA), hostScript (narasi lengkap yang dibacakan host, 3-6 kalimat), keyPoints (array 2-4 poin penting yang harus disampaikan), engagementTip (satu kalimat ajakan interaksi: poll, komentar, giveaway, dll).
- Segment pertama WAJIB berupa Opening/Hook yang menyambut penonton, memperkenalkan host & produk dalam 1-2 menit pertama.
- Segment terakhir WAJIB berupa CTA yang natural — ajak klik keranjang kuning, sebut diskon atau bonus, dan tutup dengan hangat.
- Gunakan gaya bahasa host live Indonesia: sapa "kak", "temen-temen", "kalian", gunakan pertanyaan retoris, ekspresi kaget/antusias, dan sisipkan ajakan komentar/poll.
- Variasikan tipe segment: opening → hook → demo → story → objection handling → social proof → Q&A → CTA, dll.
- Jangan gunakan emoji.
- Jangan menulis "null" atau "Unknown" di field apapun. Jika informasi tidak tersedia, gunakan string kosong "" untuk field yang opsional atau "umum" untuk field yang wajib.
- Jangan mengarang fakta spesifik (harga, testimoni, nama selebriti) yang tidak ada di konteks.`;

export interface LiveHostPromptProduct {
  name: string | null;
  brand: string | null;
  category: string | null;
  target_market: string | null;
  usp: string | null;
  benefits: string | null;
}

export interface LiveHostPromptInput {
  product: LiveHostPromptProduct;
  platform: string;
  tone: string;
  audience: string | null | undefined;
  duration: string;
}

/**
 * Build the user prompt for the Live Host Script Generator.
 *
 * Pure function — no I/O, no side effects. Returns the full user-prompt
 * string to be sent alongside `LIVE_HOST_SYSTEM_PROMPT` to the model.
 *
 * Null/empty product fields are replaced with a graceful placeholder so
 * the model never sees the literal string "null". A null `audience` is
 * treated as "umum" so the model picks a contextually appropriate one.
 *
 * Duration is in MINUTES (15, 30, 60) — the prompt reflects that and
 * asks the model to split the total minutes into 4-8 segments
 * depending on length.
 */
export function buildLiveHostPrompt(input: LiveHostPromptInput): string {
  const { product, platform, tone, audience, duration } = input;

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
  const safeDuration = valueOrPlaceholder(duration, "30");

  return `Buatkan 1 script host live streaming berdurasi ${safeDuration} MENIT untuk produk berikut.

KONTEKS PRODUK:
- Nama produk: ${name}
- Brand: ${brand}
- Kategori: ${category}
- Target pasar: ${targetMarket}
- Unique Selling Point (USP): ${usp}
- Manfaat utama: ${benefits}

PARAMETER LIVE:
- Platform: ${platform}
- Tone: ${tone}
- Target audience: ${safeAudience}
- Total durasi: ${safeDuration} menit (WAJIB dipenuhi: total menit seluruh segments HARUS sama dengan ${safeDuration})

INSTRUKSI:
- Script harus terasa natural untuk platform "${platform}" (misal: TikTok Live lebih energik & interaktif, Instagram Live bisa lebih personal, YouTube Live bisa lebih edukatif & panjang).
- Terapkan tone "${tone}" secara konsisten sepanjang script. Sesuaikan juga gaya host (casual → santai & banyak canda, professional → rapi & data-driven, funny → jokes & ekspresi lucu, inspirational → story-driven & memotivasi, controversial → hot take & diskusi).
- Target audience spesifik: ${safeAudience}. Sesuaikan bahasa, referensi, contoh, dan analogi yang relevan untuk mereka.
- Segment pertama WAJIB Opening/Hook yang menyapa penonton, memperkenalkan host & produk, dan langsung ajak interaksi (komentar, like, share).
- Bagi total ${safeDuration} menit menjadi beberapa segments yang realistis (misal untuk 15 menit: 3-4 segments; untuk 30 menit: 5-6 segments; untuk 60 menit: 6-8 segments).
- Setiap segment HARUS punya field "time" dalam format "X-Y menit" (contoh: "0-2 menit", "2-7 menit", "7-15 menit").
- Setiap segment WAJIB berisi 5 field: time, segmentName, hostScript, keyPoints (array), engagementTip.
- Variasikan tipe segment: opening, hook, demo produk, story/personal experience, objection handling, social proof, Q&A interaktif, CTA closing. Jangan monoton.
- Untuk segment demo/story: hostScript WAJIB panjang & detail (3-6 kalimat), keyPoints berisi 2-4 poin utama, engagementTip ajak penonton komentar atau poll.
- Untuk segment CTA: sebutkan benefit utama, scarcity (stok terbatas/diskon), dan arahkan ke keranjang kuning / link di bio.
- Jangan gunakan emoji.
- Jangan mengarang fakta spesifik (harga, testimoni, nama selebriti) yang tidak ada di konteks.

Output JSON (WAJIB diikuti, HANYA JSON, tidak ada text lain):
{
  "title": "string (judul sesi live singkat, Bahasa Indonesia)",
  "segments": [
    {
      "time": "string (label waktu, misal '0-2 menit')",
      "segmentName": "string (nama fase live: Opening/Hook/Demo/Story/Objection/Q&A/CTA)",
      "hostScript": "string (narasi lengkap yang dibacakan host, 3-6 kalimat, gaya Bahasa Indonesia natural)",
      "keyPoints": ["string (poin penting 1)", "string (poin penting 2)", "string (poin penting 3)"],
      "engagementTip": "string (1 kalimat ajakan interaksi penonton: poll, komentar, giveaway, dll)"
    }
  ],
  "cta": "string (1-2 kalimat Call-to-Action penutup live yang natural, arahkan ke keranjang kuning / link di bio)"
}`;
}
