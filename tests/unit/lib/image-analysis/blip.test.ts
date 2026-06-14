import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();

global.fetch = mockFetch as unknown as typeof fetch;

describe("analyzeImage", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns caption on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [
        { generated_text: "a red lipstick on white background" },
      ],
    });

    const { analyzeImage } = await import("@/lib/image-analysis/blip");
    const result = await analyzeImage("https://example.com/image.jpg");
    expect(result).toBe("a red lipstick on white background");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: expect.stringContaining("Bearer"),
        }),
        body: expect.stringContaining("https://example.com/image.jpg"),
      })
    );
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    const { analyzeImage } = await import("@/lib/image-analysis/blip");
    await expect(
      analyzeImage("https://example.com/image.jpg")
    ).rejects.toThrow(/BLIP-2 failed/);
  });

  it("returns empty string if response is empty array", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [],
    });

    const { analyzeImage } = await import("@/lib/image-analysis/blip");
    const result = await analyzeImage("https://example.com/image.jpg");
    expect(result).toBe("");
  });

  it("handles unexpected response shape", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ unexpected: "shape" }),
    });

    const { analyzeImage } = await import("@/lib/image-analysis/blip");
    const result = await analyzeImage("https://example.com/image.jpg");
    expect(result).toBe("");
  });
});
