import { describe, it, expect, vi } from "vitest";
import { withRetry } from "@/lib/ai/retry";

describe("withRetry", () => {
  it("returns result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("success");
    const result = await withRetry(fn);
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure then succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce("success");
    const result = await withRetry(fn, { maxRetries: 3, baseDelay: 10 });
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries up to maxRetries times", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockResolvedValueOnce("success");
    const result = await withRetry(fn, { maxRetries: 3, baseDelay: 10 });
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws after max retries exceeded", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("always fails"));
    await expect(
      withRetry(fn, { maxRetries: 2, baseDelay: 10 })
    ).rejects.toThrow("always fails");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("respects Retry-After header on 429", async () => {
    const error429 = Object.assign(new Error("rate limited"), {
      status: 429,
      headers: { "retry-after": "2" },
    });
    const fn = vi
      .fn()
      .mockRejectedValueOnce(error429)
      .mockResolvedValueOnce("success");
    const start = Date.now();
    const result = await withRetry(fn, { maxRetries: 3, baseDelay: 10 });
    const elapsed = Date.now() - start;
    expect(result).toBe("success");
    // Should wait ~2000ms based on retry-after header
    expect(elapsed).toBeGreaterThanOrEqual(1900);
  }, 10000);

  it("uses exponential backoff without retry-after", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce("success");
    const start = Date.now();
    await withRetry(fn, { maxRetries: 3, baseDelay: 100 });
    const elapsed = Date.now() - start;
    // baseDelay * 2^0 = 100ms first retry
    expect(elapsed).toBeGreaterThanOrEqual(90);
    expect(elapsed).toBeLessThan(500);
  });
});
