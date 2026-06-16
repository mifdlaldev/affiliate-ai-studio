/**
 * Prompt template for the Storyboard Generator flow.
 *
 * The user picks a saved product + a platform/tone/duration
 * combination. The model is asked to produce a 6-8 panel storyboard
 * for a short video (15-60s) in Bahasa Indonesia. Each panel is a
 * cinematographic shot (visuals, audio, text overlay, camera angle,
 * transition) so the content creator can film it shot-by-shot.
 *
 * Why two layers (system + user prompt):
 * - System prompt sets the global rules (output format, language,
 *   6-8 panel range, cinematographic feel, output shape).
 * - User prompt carries the per-call context (product details + params).
 *
 * IMPORTANT: keep the JSON schema and field names in sync with what
 * `lib/actions/storyboard.ts` expects to parse and persist into
 * `generations.result` (JSONB).
 *
 * Difference vs. `lib/ai/prompts/ugc-storyboard.ts`:
 * - UGC storyboard = 4-6 panels, casual phone-shot, only
 *   panel/time/visuals/audio/text.
 * - This storyboard = 6-8 panels, cinematographic planning, adds
 *   cameraAngle + transition so the user has a real shot list.
 */

export const STORYBOARD_SYSTEM_PROMPT = `Anda adalah storyboard artist profesional untuk konten video affiliate pendek di pasar Indonesia. Tugas Anda adalah membuat 1 storyboard 6-8 panel untuk video berdurasi 15, 30, atau 60 detik yang akan diposting di platform pilihan user. Output dan narasi WAJIB dalam Bahasa Indonesia yang natural.

Karakter storyboard profesional yang harus dipertahankan:
- Storyboard adalah alat perencanaan syuting (shot list), bukan naskah narasi. Setiap panel = 1 shot/kamera.
- Setiap panel WAJIB menyertakan cameraAngle (sudut kamera: close-up, medium shot, wide shot, overhead, eye-level, low angle, high angle, dll) dan transition (jenis transisi ke panel berikutnya: cut, fade, dissolve, wipe, zoom, pan, jump cut, match cut, dll).
- Visual harus spesifik dan bisa difilmkan (deskripsikan subjek, properti, pencahayaan, framing, gerakan kamera).
- Total durasi time antar panel harus konsisten dengan target durasi video (15, 30, atau 60 detik).

Constraints:
- Output HANYA JSON array valid dengan 6-8 item (6 untuk video 15 detik, 7-8 untuk video 30-60 detik), tidak ada text lain (tidak ada markdown, tidak ada penjelasan, tidak ada code fence).
- Setiap item WAJIB mengikuti schema persis seperti di bawah.
- Field "panel" adalah integer urut 1, 2, 3, ... (jangan skip nomor).
- Field "time" adalah label waktu panel (misal "0-3s" untuk panel 1, "3-10s" untuk panel 2, dst). Total durasi time antar panel harus konsisten dengan target durasi video.
- Field "visuals" mendeskripsikan apa yang terlihat di layar (subjek, properti, pencahayaan, framing, gerakan). Tulis 1-2 kalimat, spesifik dan bisa difilmkan.
- Field "audio" adalah narasi/voiceover atau sound effect (1-2 kalimat).
- Field "text" adalah teks overlay di layar (bisa string kosong "" jika tidak ada).
- Field "cameraAngle" adalah sudut kamera untuk shot ini (contoh: "Close-up produk", "Medium shot talent", "Wide shot establishing", "Overhead flat lay", "Eye-level talking head").
- Field "transition" adalah jenis transisi ke panel BERIKUTNYA (contoh: "Cut langsung", "Fade to black", "Cross dissolve", "Zoom in", "Wipe kanan", "Jump cut"). Untuk panel terakhir, isi dengan string kosong "".
- Panel pertama WAJIB berupa hook visual yang menarik perhatian dalam 3 detik pertama.
- Panel terakhir WAJIB memuat Call-to-Action (CTA) yang natural.
- Terapkan tone yang user pilih secara konsisten di audio narration.
- Jangan gunakan emoji.
- Jangan mengarang fakta spesifik (harga, testimoni spesifik, nama selebriti) yang tidak ada di konteks produk.
- Jangan menulis "null" atau "Unknown" di field apapun. Jika informasi tidak tersedia, gunakan string kosong "" untuk field opsional.`;

export interface StoryboardPromptProduct {
  name: string | null;
  brand: string | null;
  category: string | null;
  target_market: string | null;
  usp: string | null;
  benefits: string | null;
}

export interface StoryboardPromptInput {
  product: StoryboardPromptProduct;
  platform: string;
  tone: string;
  duration: string;
}

/**
 * Build the user prompt for the Storyboard Generator.
 *
 * Pure function — no I/O, no side effects. Returns the full user-prompt
 * string to be sent alongside `STORYBOARD_SYSTEM_PROMPT` to the model.
 *
 * Null/empty product fields are replaced with a graceful placeholder so
 * the model never sees the literal string "null". The 6-8 panel count is
 * calibrated against the chosen `duration`:
 *   - 15 detik → 6 panel
 *   - 30 detik → 7 panel
 *   - 60 detik → 8 panel
 */
export function buildStoryboardPrompt(input: StoryboardPromptInput): string {
  const { product, platform, tone, duration } = input;

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
  const safeDuration = valueOrPlaceholder(duration, "30");

  // Calibrate the panel count against the duration so the user gets a
  // tight shot list: 15s → 6, 30s → 7, 60s → 8. The system prompt allows
  // the 6-8 range, so this is a target the model can deviate from only
  // by 1 panel.
  const targetPanelCount =
    safeDuration === "15" ? "6" : safeDuration === "60" ? "8" : "7";

  return `Buatkan 1 storyboard ${targetPanelCount} panel untuk video affiliate berdurasi ${safeDuration} detik untuk produk berikut.

KONTEKS PRODUK:
- Nama produk: ${name}
- Brand: ${brand}
- Kategori: ${category}
- Target pasar: ${targetMarket}
- Unique Selling Point (USP): ${usp}
- Manfaat utama: ${benefits}

PARAMETER VIDEO:
- Platform target: ${platform}
- Tone gaya: ${tone}
- Total durasi: ${safeDuration} detik
- Target jumlah panel: ${targetPanelCount}

PANDUAN STORYBOARD:
- Setiap panel = 1 shot/kamera yang akan difilmkan.
- Total durasi time antar panel harus konsisten dengan target durasi video (${safeDuration} detik).
- Sesuaikan gaya dengan platform "${platform}" (tiktok lebih punchy, instagram lebih aesthetic, youtube lebih naratif).
- Hook di panel 1 WAJIB kuat: pertanyaan, statement kontroversial, atau visual yang bikin berhenti scroll dalam 3 detik pertama.
- Setiap panel WAJIB menyertakan cameraAngle (sudut kamera) dan transition (transisi ke panel berikutnya, kosong untuk panel terakhir).
- Panel terakhir WAJIB memuat CTA natural (misal: "Kalo penasaran, linknya di keranjang kuning ya").
- Jangan gunakan emoji.
- Jangan mengarang fakta spesifik (harga, testimoni, nama selebriti) yang tidak ada di konteks.

FORMAT OUTPUT (JSON array valid, 6-8 item, HANYA JSON, tidak ada text lain):
[
  {
    "panel": "number (1, 2, 3, ... urut)",
    "time": "string (label waktu, misal '0-3s', '3-10s', dst)",
    "visuals": "string (deskripsi visual 1-2 kalimat, spesifik dan bisa difilmkan)",
    "audio": "string (narasi/voiceover atau sound effect, 1-2 kalimat)",
    "text": "string (teks overlay di layar, boleh string kosong jika tidak ada)",
    "cameraAngle": "string (sudut kamera, misal 'Close-up produk', 'Wide shot establishing')",
    "transition": "string (transisi ke panel berikutnya, kosong untuk panel terakhir)"
  }
]`;
}
