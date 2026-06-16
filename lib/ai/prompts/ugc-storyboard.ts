/**
 * Prompt template for the UGC Storyboard Generator flow.
 *
 * UGC = User-Generated Content. The user picks a saved product + a
 * platform/tone combination. The model is asked to produce a 4-6
 * panel storyboard for a casual UGC video (phone-shot, not cinematic)
 * in Bahasa Indonesia. Each panel describes one shot (visuals, audio,
 * text overlay) so the content creator can film it shot-by-shot.
 *
 * Why two layers (system + user prompt):
 * - System prompt sets the global rules (output format, language, the
 *   4-6 panel range, UGC casual feel, output shape).
 * - User prompt carries the per-call context (product details + params).
 *
 * IMPORTANT: keep the JSON schema and field names in sync with what
 * `lib/actions/ugc.ts` expects to parse and persist into
 * `generations.result` (JSONB).
 */

export const UGC_STORYBOARD_SYSTEM_PROMPT = `Anda adalah storyboard artist untuk konten UGC (User-Generated Content) berbahasa Indonesia. Tugas Anda adalah membuat 1 storyboard 4-6 panel untuk video UGC pendek (15-60 detik) yang akan diposting di platform pilihan user.

Karakter UGC yang harus dipertahankan:
- Video UGC terlihat seperti direkam pakai HP, pencahayaan natural, lokasi sehari-hari (kamar, meja kerja, dapur, jalan). BUKAN produksi studio profesional.
- Talent bicara natural, seperti ngobrol dengan teman, bukan membaca script.
- Ada "imperfections" yang membuat terasa real: suara agak pecah, AC nyala di background, cahaya matahari berubah, dsb.
- Hook di 3 detik pertama WAJIB menarik (pertanyaan, statement kontroversial, atau visual yang bikin berhenti scroll).

Constraints:
- Output HANYA JSON array valid dengan 4-6 item (4 untuk video 15-30 detik, 6 untuk video 45-60 detik), tidak ada text lain (tidak ada markdown, tidak ada penjelasan, tidak ada code fence).
- Setiap item WAJIB mengikuti schema persis seperti di bawah.
- Field "panel" adalah integer urut 1, 2, 3, ... (jangan skip nomor).
- Field "time" adalah label waktu panel (misal "0-3s" untuk panel 1, "3-10s" untuk panel 2, dst). Total durasi time antar panel harus konsisten dengan target durasi video (15-60 detik).
- Field "visuals" mendeskripsikan apa yang terlihat di layar (kamera angle, ekspresi talent, properti, pencahayaan). Tulis 1-2 kalimat, spesifik dan bisa difilmkan.
- Field "audio" adalah narasi/voiceover talent, 1-2 kalimat, casual seperti ngobrol.
- Field "text" adalah teks overlay di layar (bisa string kosong "" jika tidak ada).
- Panel terakhir WAJIB memuat CTA natural yang soft (bukan hard sell).
- Terapkan tone yang user pilih secara konsisten di audio narration.
- Jangan gunakan emoji.
- Jangan mengarang fakta spesifik (harga, testimoni spesifik, nama selebriti) yang tidak ada di konteks produk.
- Jangan menulis "null" atau "Unknown" di field apapun. Jika informasi tidak tersedia, gunakan string kosong "" untuk field opsional.`;

export interface UgcStoryboardPromptProduct {
  name: string | null;
  brand: string | null;
  category: string | null;
  target_market: string | null;
  usp: string | null;
  benefits: string | null;
}

export interface UgcStoryboardPromptInput {
  product: UgcStoryboardPromptProduct;
  platform: string;
  tone: string;
}

/**
 * Build the user prompt for the UGC Storyboard Generator.
 *
 * Pure function — no I/O, no side effects. Returns the full user-prompt
 * string to be sent alongside `UGC_STORYBOARD_SYSTEM_PROMPT` to the model.
 *
 * Null/empty product fields are replaced with a graceful placeholder so
 * the model never sees the literal string "null".
 */
export function buildUgcStoryboardPrompt(
  input: UgcStoryboardPromptInput,
): string {
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
  const targetMarket = valueOrPlaceholder(
    product.target_market,
    "konsumen Indonesia umum",
  );
  const usp = valueOrPlaceholder(product.usp, "kualitas dan manfaat produk");
  const benefits = valueOrPlaceholder(
    product.benefits,
    "(manfaat spesifik tidak tersedia, gunakan USP sebagai acuan)",
  );

  return `Buatkan 1 storyboard 4-6 panel untuk video UGC berdurasi 15-60 detik untuk produk berikut.

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

INSTRUKSI:
- 4 panel untuk target durasi 15-30 detik, 6 panel untuk target 45-60 detik. Pilih jumlah yang sesuai dengan vibe "${platform}" (tiktok biasanya 15-30 detik, instagram/youtube bisa lebih panjang).
- Tiap panel harus berisi informasi yang spesifik dan bisa langsung difilmkan (kamera angle, ekspresi, properti, pencahayaan, dialog).
- Terapkan tone "${tone}" di audio narration (1-2 kalimat per panel, casual seperti ngobrol).
- Sesuaikan gaya dengan platform "${platform}" (tiktok lebih punchy, instagram lebih aesthetic, youtube lebih naratif, facebook lebih storytelling).
- Hook di panel 1 WAJIB kuat: pertanyaan, statement kontroversial, atau visual yang bikin berhenti scroll dalam 3 detik pertama.
- Panel terakhir WAJIB memuat CTA natural (misal: "Kalo penasaran, linknya di keranjang kuning ya" — BUKAN hard sell).
- Jangan gunakan emoji.
- Jangan mengarang fakta spesifik (harga, testimoni, nama selebriti) yang tidak ada di konteks.

FORMAT OUTPUT (JSON array valid, 4-6 item, HANYA JSON, tidak ada text lain):
[
  {
    "panel": "number (1, 2, 3, ... urut)",
    "time": "string (label waktu, misal '0-3s', '3-10s', dst)",
    "visuals": "string (deskripsi visual 1-2 kalimat, spesifik dan bisa difilmkan)",
    "audio": "string (narasi talent 1-2 kalimat, casual)",
    "text": "string (teks overlay di layar, boleh string kosong jika tidak ada)"
  }
]`;
}
