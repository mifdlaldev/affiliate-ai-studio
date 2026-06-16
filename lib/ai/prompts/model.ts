/**
 * Prompt template for the Model Prompt Generator flow.
 *
 * The user picks a saved product + a style/mood/setting/composition
 * combination PLUS a model profile (gender, age, vibe). The model is
 * asked to produce 3-5 prompt variations that describe a person
 * (the model) interacting with or showcasing the product, suitable
 * for Midjourney, Leonardo, or any text-to-image generator.
 *
 * The output schema extends the Photo Prompt schema with a
 * `modelDescription` field that describes the person in the prompt
 * (age, gender, vibe, pose) — this lets the dashboard show the model
 * description separately from the visual prompt.
 *
 * Why two layers (system + user prompt):
 * - System prompt sets the global rules (output format, language split,
 *   count, field schema).
 * - User prompt carries the per-call context (product details + style
 *   parameters + model profile).
 *
 * IMPORTANT: keep the JSON schema and field names in sync with what
 * `lib/actions/models.ts` (Task 2) expects to parse and persist into
 * `generations.result` (JSONB).
 */

export const MODEL_SYSTEM_PROMPT = `Anda adalah creative director untuk konten foto model + produk affiliate di pasar Indonesia. Tugas Anda adalah membuat 3-5 model prompt variations yang akan digunakan di text-to-image generator seperti Midjourney, Leonardo AI, atau DALL-E untuk membuat foto dengan model manusia yang sedang menggunakan/memamerkan produk affiliate.

Constraints:
- Output HANYA JSON array valid dengan 3-5 item, tidak ada text lain (tidak ada markdown, tidak ada penjelasan).
- Setiap item WAJIB mengikuti schema persis seperti di bawah.
- Field \`prompt\` (visual prompt untuk Midjourney/Leonardo) WAJIB dalam Bahasa Inggris yang detail — ini adalah working language Midjourney/Leonardo, bukan Bahasa Indonesia.
- Field \`title\`, \`style\`, \`mood\`, \`setting\`, \`composition\` WAJIB dalam Bahasa Indonesia untuk ditampilkan di dashboard user.
- Field \`modelDescription\` WAJIB dalam Bahasa Inggris, panjang 30-80 kata, mendeskripsikan model secara natural: gender, usia, vibe, ekspresi wajah, pose, pakaian, dan interaksi dengan produk. Contoh: "Indonesian woman in her early 30s, elegant posture, soft smile, wearing casual linen blouse, holding the serum bottle delicately with both hands".
- Field \`aspectRatio\` WAJIB salah satu dari: "1:1", "4:5", "9:16", "16:9" (default "1:1" untuk Instagram, "4:5" untuk portrait).
- Field \`lighting\` WAJIB dalam Bahasa Indonesia (contoh: "cahaya alami soft", "studio lighting dengan rim light", "golden hour warm").
- Field \`colorPalette\` WAJIB dalam Bahasa Indonesia (contoh: "earthy tone", "monokromatik", "pastel lembut").
- Field \`cameraAngle\` WAJIB dalam Bahasa Indonesia (contoh: "eye-level", "45 derajat dari atas", "low angle dramatic", "top-down flat lay").
- Jangan gunakan emoji di manapun.
- Jangan menulis "null" atau "Unknown" di field apapun. Jika informasi tidak tersedia, gunakan string kosong "" untuk field opsional.
- Variasikan pose model, angle kamera, dan ekspresi antar item supaya user punya pilihan visual yang beragam.
- Selalu sertakan model manusia dalam setiap prompt (variasi pose, angle, atau interaksi dengan produk).`;

export interface ModelPromptProduct {
  name: string | null;
  brand: string | null;
  category: string | null;
  target_market: string | null;
  usp: string | null;
  benefits: string | null;
}

export interface ModelPromptInput {
  product: ModelPromptProduct;
  style: string;
  mood: string;
  setting: string;
  composition: string;
  gender: string;
  age: string;
  modelVibe: string;
}

/**
 * Build the user prompt for the Model Prompt Generator.
 *
 * Pure function — no I/O, no side effects. Returns the full user-prompt
 * string to be sent alongside `MODEL_SYSTEM_PROMPT` to the model.
 *
 * Null/empty product fields are replaced with a graceful placeholder so
 * the model never sees the literal string "null". Style-specific guidance
 * is appended so the resulting prompts visibly differ across styles.
 * Model-profile guidance is appended so the prompts visibly differ across
 * gender/age/vibe combinations.
 */
export function buildModelPrompt(input: ModelPromptInput): string {
  const { product, style, mood, setting, composition, gender, age, modelVibe } =
    input;

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

  // Style-specific guidance to make the visual prompts differ across styles.
  const styleGuidance: Record<string, string> = {
    minimalist:
      "Gunakan background bersih, warna netral, komposisi sederhana, banyak negative space, fokus tunggal pada model + produk.",
    professional:
      "Gunakan pencahayaan studio yang merata, komposisi simetris, warna corporate, look premium dan trustworthy, model berpose profesional.",
    lifestyle:
      "Gunakan setting kehidupan nyata, pencahayaan alami, pose candid, model berinteraksi natural dengan produk, warna hangat.",
    creative:
      "Gunakan angle tidak konvensional, pencahayaan dramatis, warna berani, komposisi dinamis, model berpose ekspresif.",
  };
  const styleHint = styleGuidance[style] ?? "";

  // Model-profile guidance — echo the original parameter values so they
  // appear literally in the output, then expand them into concrete
  // description language the model can use directly.
  const genderEcho = gender;
  const ageEcho = age;
  const modelVibeEcho = modelVibe;
  const genderHint =
    gender === "any"
      ? "gender fleksibel, pilih yang paling cocok dengan target market produk"
      : gender;
  const ageHint = (() => {
    switch (age) {
      case "remaja":
        return "usia remaja (15-19 tahun), vibe youthful";
      case "dewasa":
        return "usia dewasa muda (20-35 tahun), vibe matang";
      case "paruh baya":
        return "usia paruh baya (36-55 tahun), vibe bijaksana";
      case "lansia":
        return "usia lanjut (56+ tahun), vibe elegan senior";
      default:
        return age;
    }
  })();
  const vibeHint = (() => {
    switch (modelVibe) {
      case "casual":
        return "pakaian kasual santai (kaos, jeans, sneakers), pose rileks";
      case "elegan":
        return "pakaian elegan (blouse, dress, blazer), postur tegak, ekspresi tenang";
      case "atletik":
        return "pakaian sporty (activewear, sneakers), pose energik, badan sehat";
      case "profesional":
        return "pakaian formal profesional (kemeja, blazer, celana formal), pose percaya diri";
      default:
        return modelVibe;
    }
  })();

  return `Kamu akan membuat model prompt (model manusia + produk) untuk konten affiliate.

INFORMASI PRODUK:
- Nama produk: ${name}
- Brand: ${brand}
- Kategori: ${category}
- Target market: ${targetMarket}
- USP (Unique Selling Point): ${usp}
- Benefits: ${benefits}

PARAMETER STYLE:
- Style: ${style}
- Mood: ${mood}
- Setting: ${setting}
- Composition: ${composition}

PROFIL MODEL:
- Gender: ${genderHint} (echo: ${genderEcho})
- Usia: ${ageHint} (echo: ${ageEcho})
- Vibe: ${vibeHint} (echo: ${modelVibeEcho})

PANDUAN STYLE (${style}):
${styleHint}

PANDUAN MODEL:
- Setiap item WAJIB menghasilkan field \`modelDescription\` (Bahasa Inggris, 30-80 kata) yang mendeskripsikan model secara natural: gender, usia, vibe, ekspresi wajah, pose, pakaian, dan interaksi dengan produk.
- Variasikan pose (standing, sitting, candid, product-in-hand) dan ekspresi (smile, focused, surprised, confident) antar item.

FORMAT OUTPUT (JSON array valid, 3-5 items):
[
  {
    "title": "string (judul singkat dalam Bahasa Indonesia, contoh: 'Elegant wanita dewasa showcasing produk')",
    "prompt": "string (visual prompt detail dalam Bahasa Inggris untuk Midjourney/Leonardo, panjang 50-150 kata, sertakan model + subjek produk + pencahayaan + angle + mood + style referensi seperti 'editorial model photography')",
    "style": "string (echo parameter style: ${style})",
    "mood": "string (echo parameter mood: ${mood})",
    "setting": "string (echo parameter setting: ${setting})",
    "composition": "string (echo parameter composition: ${composition})",
    "aspectRatio": "string (salah satu dari: '1:1', '4:5', '9:16', '16:9')",
    "lighting": "string (deskripsi pencahayaan dalam Bahasa Indonesia)",
    "colorPalette": "string (deskripsi palet warna dalam Bahasa Indonesia)",
    "cameraAngle": "string (deskripsi angle kamera dalam Bahasa Indonesia)",
    "modelDescription": "string (deskripsi model dalam Bahasa Inggris, 30-80 kata, gender + usia + vibe + pose + pakaian + interaksi dengan produk)"
  }
]`;
}
