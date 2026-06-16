/**
 * Prompt template for the Script Generator flow.
 *
 * The user picks a saved product + a platform/tone/audience/duration
 * combination. The model is asked to produce 1-2 short video script
 * variations in Bahasa Indonesia that can be used as a storyboard for
 * an affiliate short/reel/TikTok of the chosen duration.
 *
 * Why two layers (system + user prompt):
 * - System prompt sets the global rules (output format, language, count).
 * - User prompt carries the per-call context (product details + params).
 *
 * IMPORTANT: keep the JSON schema and field names in sync with what
 * `lib/actions/scripts.ts` (Task 2) expects to parse and persist into
 * `generations.result` (JSONB).
 */

export const SCRIPT_SYSTEM_PROMPT = `Anda adalah scriptwriter expert untuk konten video affiliate pendek di pasar Indonesia. Tugas Anda adalah membuat 1-2 script (storyboard narasi) untuk video affiliate berdurasi singkat (15, 30, atau 60 detik) yang akan diposting di platform pilihan user.

Constraints:
- Output HANYA JSON array valid, tidak ada text lain (tidak ada markdown, tidak ada penjelasan).
- Setiap item dalam array HARUS mengikuti schema persis.
- Script harus dalam Bahasa Indonesia yang natural dan sesuai target pasar Indonesia.
- Setiap script WAJIB memiliki scenes (potongan adegan) dengan timing yang realistis sehingga total durasi scenes sama dengan target durasi video (15, 30, atau 60 detik).
- Setiap scene WAJIB memiliki 4 field: time (label waktu, misal "0-3s"), visuals (apa yang tampil di layar), audio (narasi/voiceover/dialog), text (teks overlay di layar, boleh string kosong jika tidak ada).
- Scene pertama WAJIB berupa hook yang menarik perhatian dalam 3 detik pertama.
- Scene terakhir WAJIB memuat Call-to-Action (CTA) yang natural.
- Jangan gunakan emoji.
- Jangan menulis "null" atau "Unknown" di field apapun. Jika informasi tidak tersedia, gunakan string kosong "" untuk field yang opsional atau "umum" untuk field yang wajib.
- Variasikan gaya antar script (problem-solution, storytelling, review jujur, demo cepat, dll) supaya user punya pilihan.`;

export interface ScriptPromptProduct {
  name: string | null;
  brand: string | null;
  category: string | null;
  target_market: string | null;
  usp: string | null;
  benefits: string | null;
}

export interface ScriptPromptInput {
  product: ScriptPromptProduct;
  platform: string;
  tone: string;
  audience: string | null | undefined;
  duration: string;
}

/**
 * Build the user prompt for the Script Generator.
 *
 * Pure function — no I/O, no side effects. Returns the full user-prompt
 * string to be sent alongside `SCRIPT_SYSTEM_PROMPT` to the model.
 *
 * Null/empty product fields are replaced with a graceful placeholder so
 * the model never sees the literal string "null". A null `audience` is
 * treated as "umum" so the model picks a contextually appropriate one.
 */
export function buildScriptPrompt(input: ScriptPromptInput): string {
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

  return `Buatkan 1-2 script video affiliate berdurasi ${safeDuration} detik untuk produk berikut.

KONTEKS PRODUK:
- Nama produk: ${name}
- Brand: ${brand}
- Kategori: ${category}
- Target pasar: ${targetMarket}
- Unique Selling Point (USP): ${usp}
- Manfaat utama: ${benefits}

PARAMETER VIDEO:
- Platform: ${platform}
- Tone: ${tone}
- Target audience: ${safeAudience}
- Total durasi: ${safeDuration} detik (WAJIB dipenuhi: jumlah detik seluruh scenes HARUS sama dengan ${safeDuration})

INSTRUKSI:
- Setiap script harus terasa natural untuk platform "${platform}" (misal: TikTok lebih punchy & cepat, Instagram Reels bisa storytelling singkat, YouTube Shorts bisa lebih edukatif).
- Terapkan tone "${tone}" secara konsisten tapi variasikan STRUKTUR (problem-solution, storytelling, review, demo, dll) supaya user punya beberapa opsi.
- Target audience spesifik: ${safeAudience}. Sesuaikan bahasa, referensi, dan contoh yang relevan untuk mereka.
- Scene pertama WAJIB hook kuat yang menahan penonton dalam 3 detik pertama.
- Bagi total ${safeDuration} detik menjadi beberapa scenes (misal untuk 30 detik: 3-5 scenes; untuk 60 detik: 5-8 scenes; untuk 15 detik: 2-3 scenes).
- Setiap scene HARUS punya field "time" dalam format "Xs-Ys" (contoh: "0-3s", "3-8s").
- Jangan gunakan emoji.
- Jangan mengarang fakta spesifik (harga, testimoni, nama selebriti) yang tidak ada di konteks.

Output JSON array (WAJIB diikuti, HANYA JSON, tidak ada text lain):
[
  {
    "title": "string (judul script singkat, Bahasa Indonesia)",
    "scenes": [
      {
        "time": "string (label waktu, misal '0-3s')",
        "visuals": "string (deskripsi apa yang tampil di layar, 1-2 kalimat)",
        "audio": "string (narasi/voiceover yang dibacakan, 1-2 kalimat)",
        "text": "string (teks overlay di layar, boleh string kosong jika tidak ada)"
      }
    ],
    "cta": "string (1 kalimat Call-to-Action yang natural di akhir video)"
  }
]`;
}
