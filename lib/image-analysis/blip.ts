/**
 * HuggingFace BLIP-2 image captioning helper.
 *
 * Wraps the HuggingFace Inference API for `Salesforce/blip-image-captioning-large`
 * so the rest of the app can call a simple `analyzeImage(url) → string`. The
 * endpoint expects a JSON body of the form `{ "inputs": "<image-url>" }` and
 * returns an array of `{ generated_text: string }` records.
 *
 * NOTE: HuggingFace BLIP-2 expects an HTTP-accessible image URL. We currently
 * pass through whatever the caller provides (which is a data URL during
 * development — see the Task 11 design notes). If BLIP-2 rejects the data
 * URL, the caller's try/catch should treat the failure as non-fatal and
 * continue with an empty description. The long-term fix is to upload the
 * file to Supabase Storage first and pass the resulting public URL.
 */

interface BlipResponse {
  generated_text?: string;
}

const BLIP_ENDPOINT =
  "https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large";

export async function analyzeImage(imageUrl: string): Promise<string> {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) {
    throw new Error("HUGGINGFACE_API_KEY is not configured");
  }

  const response = await fetch(BLIP_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ inputs: imageUrl }),
  });

  if (!response.ok) {
    throw new Error(
      `BLIP-2 failed: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as BlipResponse[] | unknown;

  if (Array.isArray(data) && data.length > 0) {
    const first = data[0];
    if (first && typeof first === "object" && "generated_text" in first) {
      return first.generated_text ?? "";
    }
  }

  return "";
}
