/**
 * Prompt template for the Content Calendar Generator flow.
 *
 * The user picks 1-10 saved products + a month/year + a list of content
 * types + a platform (or "mixed") + a tone. The model is asked to produce
 * a day-by-day content calendar for the chosen month: 28-31 items, one
 * per day, spreading the products evenly across the month and mixing the
 * requested content types so the calendar feels coherent, not random.
 *
 * Why two layers (system + user prompt):
 * - System prompt sets the global rules (output format, language, count,
 *   product-spreading rules, content-type rotation, field schema).
 * - User prompt carries the per-call context (product list + month/year +
 *   content types + platform + tone).
 *
 * IMPORTANT: keep the JSON schema and field names in sync with what
 * `lib/actions/calendar.ts` (Task 2) expects to parse and persist into
 * `generations.result` (JSONB).
 */

export const CALENDAR_SYSTEM_PROMPT = `Anda adalah content strategist untuk pasar affiliate Indonesia. Tugas Anda adalah membuat content calendar bulanan (28-31 hari, satu item per hari untuk bulan yang dipilih) yang siap dieksekusi oleh content creator affiliate.

Constraints:
- Output HANYA JSON array valid dengan jumlah item SAMA DENGAN jumlah hari dalam bulan target (28, 29, 30, atau 31 hari). Tidak ada text lain (tidak ada markdown, tidak ada penjelasan, tidak ada code fence).
- Setiap item WAJIB mengikuti schema persis seperti di bawah.
- Field "day" adalah angka integer 1 sampai jumlah hari bulan tersebut (1 untuk hari pertama, dst).
- Field "productId" dan "productName" WAJIB merujuk ke salah satu produk yang diberikan user (tidak boleh produk di luar daftar).
- Sebaran produk: distribusi produk secara merata dan natural sepanjang bulan (jangan menumpuk 1 produk di awal bulan saja). Jika jumlah hari > jumlah produk, produk boleh muncul lebih dari 1x dengan jeda yang natural.
- Rotasi content type: variasikan content type antar hari sehingga calendar tidak monoton. Campurkan tipe yang user pilih secara proporsional.
- Platform: jika user memilih platform spesifik (bukan "mixed"), WAJIB gunakan platform tersebut di setiap item. Jika "mixed", variasikan platform per hari (tiktok, instagram, youtube, twitter, facebook) secara natural sesuai content type-nya.
- Field "topic" WAJIB dalam Bahasa Indonesia, 5-15 kata, mendeskripsikan angle/topik konten hari itu.
- Field "hook" WAJIB dalam Bahasa Indonesia, 10-25 kata, berupa kalimat hook pembuka yang menarik (kalimat pertama video/caption, bukan ide umum).
- Field "productId" WAJIB UUID valid dari daftar produk. Echo product name persis seperti yang user berikan.
- Terapkan tone "${"${tone}"}" secara konsisten di topic + hook untuk semua hari.
- Jangan gunakan emoji.
- Jangan menulis "null" atau "Unknown" di field apapun. Jika informasi tidak tersedia, gunakan string kosong "" untuk field opsional.
- Jangan mengarang fakta spesifik (harga, testimoni, nama selebriti) yang tidak ada di konteks produk.`;

export interface CalendarPromptProduct {
  id: string;
  name: string;
  category: string | null;
  brand: string | null;
}

export interface CalendarPromptInput {
  products: CalendarPromptProduct[];
  month: number;
  year: number;
  contentTypes: string[];
  platform: string;
  tone: string;
}

const MONTH_NAMES_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

/**
 * Build the user prompt for the Content Calendar Generator.
 *
 * Pure function — no I/O, no side effects. Returns the full user-prompt
 * string to be sent alongside `CALENDAR_SYSTEM_PROMPT` to the model.
 *
 * Null/empty product fields are replaced with a graceful placeholder so
 * the model never sees the literal string "null". Products are listed
 * with id + name + category + brand so the model can spread them
 * intelligently. Content types are joined into a human-readable list
 * so the model can rotate through them.
 */
export function buildCalendarPrompt(input: CalendarPromptInput): string {
  const { products, month, year, contentTypes, platform, tone } = input;

  const valueOrPlaceholder = (
    v: string | null | undefined,
    placeholder: string,
  ): string => {
    if (v == null) return placeholder;
    const trimmed = v.trim();
    return trimmed === "" ? placeholder : trimmed;
  };

  const monthName = MONTH_NAMES_ID[month - 1] ?? "bulan ini";
  const productLines = products
    .map((p, i) => {
      const name = valueOrPlaceholder(p.name, `Produk ${i + 1}`);
      const brand = valueOrPlaceholder(p.brand, "tidak diketahui");
      const category = valueOrPlaceholder(p.category, "umum");
      return `- id: ${p.id}\n  nama: ${name}\n  brand: ${brand}\n  kategori: ${category}`;
    })
    .join("\n");

  const contentTypeList = contentTypes
    .map((t) => `"${t}"`)
    .join(", ");

  return `Buatkan content calendar untuk ${monthName} ${year} dengan produk-produk berikut.

DAFTAR PRODUK (${products.length} item):
${productLines}

PARAMETER CALENDAR:
- Bulan: ${month} (${monthName})
- Tahun: ${year}
- Content types yang diizinkan: ${contentTypeList}
- Platform: ${platform}
- Tone: ${tone}
- Jumlah hari: calendar harus memiliki 28-31 item (satu per hari, mengikuti jumlah hari di ${monthName} ${year})

INSTRUKSI:
- Sebaran produk: distribusikan ${products.length} produk secara merata sepanjang bulan. Jangan menumpuk 1 produk di awal saja — kalau bulan lebih panjang dari jumlah produk, setiap produk boleh muncul beberapa kali dengan jeda yang natural (5-10 hari).
- Rotasi content type: variasikan tipe konten (${contentTypeList}) secara proporsional sehingga calendar terasa hidup dan tidak monoton.
- Platform "${platform}": ${platform === "mixed" ? "variasikan platform per hari (tiktok, instagram, youtube, twitter, facebook) secara natural — match content type dengan platform yang paling cocok (misal reel → instagram, short → tiktok, thread → twitter)." : `setiap item WAJIB menggunakan platform "${platform}".`}
- Terapkan tone "${tone}" di topic + hook untuk konsistensi voice seluruh bulan.
- Topic (5-15 kata) + hook (10-25 kata) harus terasa natural untuk Bahasa Indonesia sehari-hari, bukan kaku atau template-y.
- Jangan gunakan emoji.
- Jangan mengarang fakta spesifik (harga, testimoni, nama selebriti) yang tidak ada di konteks produk.

FORMAT OUTPUT (JSON array valid, satu item per hari, HANYA JSON, tidak ada text lain):
[
  {
    "day": "number (1 sampai jumlah hari di ${monthName} ${year})",
    "productId": "string (UUID salah satu produk dari daftar di atas)",
    "productName": "string (echo nama produk persis seperti di daftar)",
    "contentType": "string (salah satu dari: ${contentTypeList})",
    "platform": "string (platform untuk item ini — mengikuti parameter di atas)",
    "topic": "string (5-15 kata, Bahasa Indonesia, angle/topik konten hari itu)",
    "hook": "string (10-25 kata, Bahasa Indonesia, kalimat hook pembuka yang menarik)"
  }
]`;
}
