/**
 * Prompt template for the UGC Image-Prompt Generator flow.
 *
 * The user picks a saved product + a photo style (selfie, unboxing,
 * testimonial, etc.) + a mood. The model is asked to produce 3-5
 * English image-generation prompts (Midjourney / Stable Diffusion /
 * DALL-E compatible) that look like authentic user-generated phone
 * photos — NOT polished studio shots.
 *
 * Why two layers (system + user prompt):
 * - System prompt sets the global rules (output format, language split
 *   between title (Bahasa Indonesia) + prompt (English), UGC realism,
 *   no studio polish, output shape).
 * - User prompt carries the per-call context (product + style + mood).
 *
 * IMPORTANT: keep the JSON schema and field names in sync with what
 * `lib/actions/ugc.ts` expects to parse and persist into
 * `generations.result` (JSONB).
 */

export const UGC_PROMPT_SYSTEM_PROMPT = `Anda adalah creative director untuk konten UGC (User-Generated Content) visual. Tugas Anda adalah membuat 3-5 prompt image-generation yang siap dipakai di Midjourney, Stable Diffusion, atau DALL-E, untuk menghasilkan foto yang terlihat seperti UGC (User-Generated Content) asli — BUKAN foto studio profesional.

Karakteristik foto UGC yang harus dihasilkan:
- Terlihat seperti difoto pakai HP (smartphone camera), bukan DSLR atau studio.
- Pencahayaan natural (cahaya matahari, lampu kamar, lampu kafe) — BUKAN studio lighting 3-point.
- Lokasi sehari-hari (kamar, meja kerja, dapur, kafe, jalan) — BUKAN studio polos.
- Subjek adalah orang biasa yang sedang menggunakan produk, dengan ekspresi natural (senyum tipis, fokus, excited, kaget, dsb).
- Ada elemen "imperfections" yang membuat terasa real: sedikit blur, jari kelihatan di pinggir frame, angle candid, komposisi tidak simetris.
- Tidak ada teks, logo, atau watermark di gambar (user akan tambahkan nanti di editing).
- Tidak ada orang lain selain talent/subjek utama (fokus pada 1 orang + produk).

Constraints:
- Output HANYA JSON array valid dengan 3-5 item, tidak ada text lain (tidak ada markdown, tidak ada penjelasan, tidak ada code fence).
- Setiap item WAJIB mengikuti schema persis seperti di bawah.
- Field "title" adalah judul singkat (3-8 kata) dalam Bahasa Indonesia untuk caption.
- Field "prompt" adalah prompt image-generation dalam Bahasa Inggris (kompatibel Midjourney/SD/DALL-E), 30-80 kata, sangat deskriptif. Tulis dalam style comma-separated tags + natural language. WAJIB dalam English.
- Field "style" dan "mood" WAJIB echo persis dari parameter user (supaya user bisa filter history by style/mood).
- Field "prompt" WAJIB mengandung unsur: subject (orang), produk, action (sedang melakukan apa), setting (lokasi), lighting, camera style (phone/handheld), mood.
- Jangan gunakan emoji di output.
- Jangan menulis "null" atau "Unknown" di field apapun.
- Jangan mengarang fakta spesifik tentang produk (ukuran, harga, klaim medis) yang tidak ada di konteks.`;

export interface UgcPromptProduct {
  name: string | null;
  brand: string | null;
  category: string | null;
  benefits: string | null;
  usp: string | null;
}

export interface UgcPromptInput {
  product: UgcPromptProduct;
  style: string;
  mood: string;
}

/**
 * Build the user prompt for the UGC Image-Prompt Generator.
 *
 * Pure function — no I/O, no side effects. Returns the full user-prompt
 * string to be sent alongside `UGC_PROMPT_SYSTEM_PROMPT` to the model.
 *
 * Null/empty product fields are replaced with a graceful placeholder so
 * the model never sees the literal string "null".
 */
export function buildUgcPrompt(input: UgcPromptInput): string {
  const { product, style, mood } = input;

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
  const benefits = valueOrPlaceholder(
    product.benefits,
    "(manfaat spesifik tidak tersedia, gunakan USP sebagai acuan)",
  );
  const usp = valueOrPlaceholder(
    product.usp,
    "kualitas dan manfaat produk",
  );

  return `Buatkan 3-5 prompt image-generation UGC (User-Generated Content) untuk produk berikut.

KONTEKS PRODUK:
- Nama produk: ${name}
- Brand: ${brand}
- Kategori: ${category}
- Manfaat utama: ${benefits}
- Unique Selling Point (USP): ${usp}

PARAMETER IMAGE:
- Style: ${style}
- Mood: ${mood}

INSTRUKSI:
- Hasilkan 3-5 prompt image-generation yang siap dipakai di Midjourney / Stable Diffusion / DALL-E.
- Setiap prompt WAJIB dalam Bahasa Inggris (untuk kompatibilitas image-gen tools).
- Style "${style}": sesuaikan deskripsi visual dengan style ini. Contoh:
  - "selfie" = subjek memegang HP, angle dari depan/dekat, candid.
  - "unboxing" = subjek membuka packaging, tangan kelihatan, excited.
  - "lifestyle" = subjek menggunakan produk dalam aktivitas sehari-hari (masak, kerja, olahraga).
  - "review" = subjek menunjukkan produk ke kamera, ada gesture "lihat ini".
  - "testimonial" = subjek bicara ke kamera, ekspresi meyakinkan.
- Mood "${mood}": sesuaikan ekspresi subjek, pencahayaan, dan tone warna.
- Foto harus terlihat casual dan real (smartphone camera, pencahayaan natural, lokasi sehari-hari), BUKAN studio profesional.
- Tiap prompt WAJIB mengandung: subject, produk, action, setting, lighting, camera style (handheld/phone), mood.
- Title (Bahasa Indonesia) untuk tiap prompt adalah 3-8 kata yang menarik untuk caption.
- Jangan gunakan emoji.
- Jangan mengarang klaim produk (ukuran, harga, klaim medis) yang tidak ada di konteks.

FORMAT OUTPUT (JSON array valid, 3-5 item, HANYA JSON, tidak ada text lain):
[
  {
    "title": "string (judul singkat 3-8 kata, Bahasa Indonesia)",
    "prompt": "string (image-gen prompt 30-80 kata, Bahasa Inggris, comma-separated tags + natural language)",
    "style": "string (echo parameter style: ${style})",
    "mood": "string (echo parameter mood: ${mood})"
  }
]`;
}
